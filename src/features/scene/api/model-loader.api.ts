import {
  ImportMeshAsync,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { StructureEntity } from "@/models/atlas.model";

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
 * Add a structure to the scene.
 *
 * Does nothing if the structure is already added or is malformed.
 *
 * @param structure Entity information for the structure.
 * @param scene Scene to add the structure to.
 */
export async function addStructure(structure: StructureEntity, scene: Scene) {
  const atlasRootNode = buildAtlasRootNode(scene);

  // Exit if structure already exists.
  if (
    atlasRootNode
      .getChildren()
      .find(childStructure => childStructure.name === structure.name)
  )
    return;

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
 * Remove a structure from the scene.
 *
 * Does nothing if the structure isn't present.
 *
 * @param structure Entity information for the structure.
 * @param scene Scene to remove the structure from.
 */
export function removeStructure(structure: StructureEntity, scene: Scene) {
  const atlasRootNode = buildAtlasRootNode(scene);

  const childStructure = atlasRootNode
    .getChildren()
    .find(child => child.name === structure.name);

  childStructure?.dispose();
}

/**
 * Set the alpha (transparency) of a structure's material.
 *
 * Does nothing if the structure's material isn't loaded.
 *
 * @param structure Entity information for the structure.
 * @param alpha Alpha value to set, between 0 and 1.
 * @param scene Scene the structure belongs to.
 */
export function setStructureAlpha(
  structure: StructureEntity,
  alpha: number,
  scene: Scene
) {
  const material = scene.getMaterialByName(`${structure.name}_material`);
  if (!material) return;

  material.alpha = alpha;
}
