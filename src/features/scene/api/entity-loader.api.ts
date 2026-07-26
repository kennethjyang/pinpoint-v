import {
  DracoDecoder,
  Logger,
  Mesh,
  StandardMaterial,
  TransformNode,
  VertexBuffer,
  VertexData,
  Vector3
} from "@babylonjs/core";
import type { IndicesArray, Scene } from "@babylonjs/core";
import axios from "axios";
import type { StructureEntity } from "@/features/scene";
import { asrToBabylon, simplifyGeometryInWorker } from "@/features/scene";

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
 * Flip a flat array of triangle indices' winding order in place.
 *
 * BrainGlobe meshes are wound for a right-handed system, but the scene is
 * left-handed; without this, faces are backface-culled and computed normals
 * point inward.
 * @param indices Flat triangle indices, mutated in place.
 */
function flipIndicesWindingOrder(indices: IndicesArray): void {
  for (let i = 0; i < indices.length; i += 3) {
    const temp = indices[i + 1]!;
    indices[i + 1] = indices[i + 2]!;
    indices[i + 2] = temp;
  }
}

/**
 * Flip a mesh's triangle winding order in place. See
 * {@link flipIndicesWindingOrder}.
 * @param mesh Mesh whose indices should be flipped.
 */
export function flipWindingOrder(mesh: Mesh): void {
  const indices = mesh.getIndices();
  if (!indices) return;

  const flipped = Array.from(indices);
  flipIndicesWindingOrder(flipped);
  mesh.setIndices(flipped);
}

/**
 * Decoded structure geometry, ready to hand off to the simplification
 * worker: winding order corrected, and nanometer-scale coordinates converted
 * to millimeters.
 */
interface DecodedMeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

/**
 * Decode raw Draco mesh data into flat vertex data, correcting its winding
 * order and converting its nanometer-scale coordinates to millimeters.
 * @param name Name for the decoded geometry.
 * @param data Raw Draco-compressed mesh bytes.
 * @param scene Scene to decode the mesh into.
 */
export async function decodeMesh(
  name: string,
  data: ArrayBuffer,
  scene: Scene
): Promise<DecodedMeshData> {
  const geometry = await DracoDecoder.Default.decodeMeshToGeometryAsync(
    name,
    scene,
    data
  );

  const positions = Float32Array.from(
    geometry.getVerticesData(VertexBuffer.PositionKind) ?? []
  );
  for (let i = 0; i < positions.length; i++) {
    positions[i]! *= NANOMETERS_TO_MILLIMETERS;
  }

  const indices = Uint32Array.from(geometry.getIndices() ?? []);
  flipIndicesWindingOrder(indices);

  // The geometry is registered with the scene, but only its raw arrays are
  // needed here -- dispose it now that they've been copied out.
  geometry.dispose();

  return { positions, indices };
}

/**
 * Build the atlas root node or return the existing one.
 * @param scene Babylon scene to get the atlas root node from.
 */
function buildAtlasRootNode(scene: Scene): TransformNode {
  let atlasRootNode = scene.getTransformNodeByName("atlasRoot_node");
  if (!atlasRootNode) {
    atlasRootNode = new TransformNode("atlasRoot_node", scene);
    atlasRootNode.rotation = new Vector3(Math.PI, 0, 0);
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
 * Does nothing if the structure is malformed. Fetching and Draco decoding
 * happen on the main thread (Draco already runs its own worker pool
 * internally); the compute-heavy simplification is delegated to
 * {@link simplifyGeometryInWorker} so many structures can load concurrently
 * without blocking the main thread.
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
    const decoded = await decodeMesh(structure.name, data, scene);
    const simplified = await simplifyGeometryInWorker(
      decoded.positions,
      decoded.indices,
      targetVertexCount(decoded.positions.length / 3)
    );

    const mesh = new Mesh(structure.name, scene);
    const vertexData = new VertexData();
    vertexData.positions = simplified.positions;
    vertexData.normals = simplified.normals;
    vertexData.indices = simplified.indices;
    vertexData.applyToMesh(mesh);

    // Configure this structure.
    mesh.parent = atlasRootNode;

    // Apply the color.
    const material = new StandardMaterial(`${structure.name}_material`, scene);
    material.diffuseColor = structure.color;
    mesh.material = material;
  } catch (error) {
    // Skip structures that fail to load, but don't hide why.
    Logger.Warn(
      `Failed to import structure ${structure.name}: ${String(error)}`
    );
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
 * Missing structures are imported concurrently rather than one at a time, so
 * total load time is bound by the slowest structure rather than their sum.
 *
 * @param scene Scene to sync.
 * @param alwaysPresentStructures Structures to keep in the scene at all times.
 * @param visibleStructures Structures that should be fully visible.
 * @param onProgress Called after each missing structure finishes importing
 * (whether it succeeded or failed), with the running and total count. Not
 * called at all if no structures need importing.
 */
export async function syncStructureVisibility(
  scene: Scene,
  alwaysPresentStructures: StructureEntity[],
  visibleStructures: StructureEntity[],
  onProgress: (completed: number, total: number) => void
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

  // Import every missing structure concurrently, and await them collectively
  // rather than one at a time.
  const missing = [...desired.values()].filter(
    structure => !present.has(structure.name)
  );
  if (missing.length > 0) {
    let completed = 0;
    onProgress(completed, missing.length);
    await Promise.all(
      missing.map(async structure => {
        try {
          await importStructure(structure, atlasRootNode, scene);
        } finally {
          completed++;
          onProgress(completed, missing.length);
        }
      })
    );
  }

  // Now that every structure is in the scene, set alpha for each of them.
  for (const [name] of desired) {
    const material = scene.getMaterialByName(`${name}_material`);
    if (material) material.alpha = visibleNames.has(name) ? 1 : 0.1;
  }
}
