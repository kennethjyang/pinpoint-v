import {
  ImportMeshAsync,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { StructureEntity } from "@/models/atlas.model";
import { asrToBabylon } from "@/features/scene";

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
  atlasRootNode.position = asrToBabylon(referenceCoordinate);
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
    const { meshes } = await ImportMeshAsync(structure.meshPath, scene);

    // Exit if the structure doesn't exist.
    if (!meshes[0]) return;

    // Configure this structure.
    meshes[0].parent = atlasRootNode;
    meshes[0].name = structure.name;

    // Apply the color.
    const material = new StandardMaterial(`${structure.name}_material`, scene);
    material.diffuseColor = structure.color;
    for (const mesh of meshes) {
      mesh.material = material;
    }
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
