import {
  DracoDecoder,
  Matrix,
  Mesh,
  QuadraticErrorSimplification,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import axios from "axios";
import type { StructureEntity } from "@/features/scene";
import { asrToBabylon } from "@/features/scene";

/** BrainGlobe v3 Draco meshes store positions in nanometers. */
const NANOMETERS_TO_MILLIMETERS = 1e-6;

/** Keep at most this fraction of a mesh's original vertices. */
const MESH_VERTEX_KEEP_FRACTION = 0.05;

/** Hard ceiling on vertices per structure, regardless of original size. */
const MESH_MAX_VERTICES = 8000;

/**
 * Compute the vertex budget for a simplified mesh: at most
 * `MESH_VERTEX_KEEP_FRACTION` of the original, capped at `MESH_MAX_VERTICES`.
 * @param vertexCount Original vertex count.
 */
export function targetVertexCount(vertexCount: number): number {
  return Math.min(
    Math.round(vertexCount * MESH_VERTEX_KEEP_FRACTION),
    MESH_MAX_VERTICES
  );
}

/**
 * Fetch a structure's raw Draco-compressed mesh bytes.
 * @param meshPath URL of the mesh to fetch.
 */
export async function fetchMeshData(meshPath: string): Promise<ArrayBuffer> {
  const response = await axios.get<ArrayBuffer>(meshPath, {
    responseType: "arraybuffer"
  });
  return response.data;
}

/**
 * Flip a mesh's triangle winding order in place.
 *
 * BrainGlobe meshes are wound for a right-handed system, but the scene is
 * left-handed; without this, faces are backface-culled and computed normals
 * point inward.
 * @param mesh Mesh whose indices should be flipped.
 */
export function flipWindingOrder(mesh: Mesh): void {
  const indices = mesh.getIndices();
  if (!indices) return;

  const flipped = Array.from(indices);
  for (let i = 0; i < flipped.length; i += 3) {
    const temp = flipped[i + 1]!;
    flipped[i + 1] = flipped[i + 2]!;
    flipped[i + 2] = temp;
  }
  mesh.setIndices(flipped);
}

/**
 * Decode raw Draco mesh data into a Babylon mesh, correcting its winding
 * order and converting its nanometer-scale coordinates to millimeters.
 * @param name Name for the decoded mesh.
 * @param data Raw Draco-compressed mesh bytes.
 * @param scene Scene to decode the mesh into.
 */
export async function decodeMesh(
  name: string,
  data: ArrayBuffer,
  scene: Scene
): Promise<Mesh> {
  const geometry = await DracoDecoder.Default.decodeMeshToGeometryAsync(
    name,
    scene,
    data
  );

  const mesh = new Mesh(name, scene);
  geometry.applyToMesh(mesh);

  flipWindingOrder(mesh);
  mesh.bakeTransformIntoVertices(
    Matrix.Scaling(
      NANOMETERS_TO_MILLIMETERS,
      NANOMETERS_TO_MILLIMETERS,
      NANOMETERS_TO_MILLIMETERS
    )
  );

  return mesh;
}

/**
 * Simplify a mesh down to (approximately) the given vertex count, discarding
 * the original mesh since it's no longer needed.
 * @param mesh Mesh to simplify.
 * @param targetVertices Desired vertex count.
 */
export async function simplifyMesh(
  mesh: Mesh,
  targetVertices: number
): Promise<Mesh> {
  const vertexCount = mesh.getTotalVertices();
  if (targetVertices >= vertexCount) return mesh;

  const simplified = await new Promise<Mesh>(resolve => {
    new QuadraticErrorSimplification(mesh).simplify(
      {
        quality: targetVertices / vertexCount,
        distance: 0,
        optimizeMesh: false
      },
      resolve
    );
  });

  mesh.dispose();
  return simplified;
}

/**
 * Build the atlas root node or return the existing one.
 * @param scene Babylon scene to get the atlas root node from.
 */
function buildAtlasRootNode(scene: Scene): TransformNode {
  let atlasRootNode = scene.getTransformNodeByName("atlasRoot_node");
  if (!atlasRootNode) {
    atlasRootNode = new TransformNode("atlasRoot_node", scene);
    atlasRootNode.rotation = new Vector3(Math.PI, -Math.PI / 2, 0);
  }

  return atlasRootNode;
}

/**
 * Offset the atlas root node so the given reference coordinate sits at the
 * scene origin.
 *
 * @param scene Scene containing the atlas root.
 * @param referenceCoordinate Reference coordinate (in ASR, mm) that the atlas
 * root should be offset by.
 */
export function setAtlasRootReference(
  scene: Scene,
  referenceCoordinate: [number, number, number]
) {
  const atlasRootNode = buildAtlasRootNode(scene);
  atlasRootNode.position = asrToBabylon(referenceCoordinate).negate();
}

/**
 * Import a structure's mesh into the scene and apply its color.
 *
 * Does nothing if the structure is malformed.
 *
 * @param structure Entity information for the structure.
 * @param atlasRootNode Atlas root node to parent the structure under.
 * @param scene Scene to add the structure to.
 */
async function importStructure(
  structure: StructureEntity,
  atlasRootNode: TransformNode,
  scene: Scene
) {
  try {
    const data = await fetchMeshData(structure.meshPath);
    const raw = await decodeMesh(structure.name, data, scene);
    const mesh = await simplifyMesh(
      raw,
      targetVertexCount(raw.getTotalVertices())
    );

    // Simplification returns a new (initially hidden, renamed) mesh.
    mesh.name = structure.name;
    mesh.isVisible = true;

    // Enable smooth shading now that the mesh has its final geometry.
    mesh.createNormals(false);

    // Configure this structure.
    mesh.parent = atlasRootNode;

    // Apply the color.
    const material = new StandardMaterial(`${structure.name}_material`, scene);
    material.diffuseColor = structure.color;
    mesh.material = material;
  } catch {
    // Exit if the structure doesn't exist.
    return;
  }
}

/**
 * Sync the scene's structures with the given visibility.
 *
 * Structures in `alwaysPresentStructures` are never removed from the scene;
 * when they aren't also in `visibleStructures` they're faded out instead.
 * Structures in `visibleStructures` are fully visible, and are removed from
 * the scene once they're no longer in either list.
 *
 * @param scene Scene to sync.
 * @param alwaysPresentStructures Structures to keep in the scene at all times.
 * @param visibleStructures Structures that should be fully visible.
 */
export async function syncStructureVisibility(
  scene: Scene,
  alwaysPresentStructures: StructureEntity[],
  visibleStructures: StructureEntity[]
) {
  const atlasRootNode = buildAtlasRootNode(scene);
  const present = new Map(
    atlasRootNode.getChildren().map(child => [child.name, child])
  );

  const visibleNames = new Set(visibleStructures.map(({ name }) => name));
  const desired = new Map(
    [...alwaysPresentStructures, ...visibleStructures].map(structure => [
      structure.name,
      structure
    ])
  );

  // Remove structures that are present but no longer desired.
  for (const [name, node] of present) {
    if (!desired.has(name)) node.dispose();
  }

  // Ensure each desired structure is in the scene with the right alpha.
  for (const [name, structure] of desired) {
    if (!present.has(name)) {
      await importStructure(structure, atlasRootNode, scene);
    }

    const material = scene.getMaterialByName(`${name}_material`);
    if (material) material.alpha = visibleNames.has(name) ? 1 : 0.1;
  }
}
