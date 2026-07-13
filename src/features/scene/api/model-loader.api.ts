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
  } else {
    atlasRootNode.getChildren().forEach(child => child.dispose());
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
 * Add the listed meshes into the atlas node, colored to match the given structure colors.
 *
 * @param structures Path and color for each structure mesh to load.
 * @param scene Babylon scene to put structures into.
 */
export async function setStructures(
  structures: StructureEntity[],
  scene: Scene
) {
  const rootNode = buildAtlasRootNode(scene);

  // Load them into the scene as children of the root node.
  for (const { name, meshPath, color } of structures) {
    const { meshes } = await ImportMeshAsync(meshPath, scene);

    if (!meshes[0]) continue;
    meshes[0].parent = rootNode;
    meshes[0].name = name;

    // Apply the color and transparency.
    const material = new StandardMaterial(`${meshPath}_material`, scene);
    material.diffuseColor = color;

    for (const mesh of meshes) {
      mesh.material = material;
    }
  }
}
