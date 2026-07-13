import {
  ImportMeshAsync,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { StructureEntityConfiguration } from "@/models/atlas.model";

/**
 * Build the atlas root note or return the existing one.
 * @param scene Babylon scene to get the atlas root node from.
 */
function buildAtlasRootNode(scene: Scene): TransformNode {
  let rootNode = scene.getTransformNodeByName("atlasRoot_node");
  if (!rootNode) {
    rootNode = new TransformNode("atlasRoot_node", scene);
    rootNode.rotation = new Vector3(Math.PI, -Math.PI / 2, 0);
  } else {
    rootNode.getChildren().forEach(child => child.dispose());
  }

  return rootNode;
}

/**
 * Add the listed meshes into the atlas node, colored to match the given structure colors.
 *
 * @param structures Path and color for each structure mesh to load.
 * @param scene Babylon scene to put structures into.
 */
export async function setStructures(
  structures: StructureEntityConfiguration[],
  scene: Scene
) {
  const rootNode = buildAtlasRootNode(scene);

  // Load them into the scene as children of the root node.
  for (const { name, meshPath, color, alpha } of structures) {
    const { meshes } = await ImportMeshAsync(meshPath, scene);

    if (!meshes[0]) continue;
    meshes[0].parent = rootNode;
    meshes[0].name = name;

    // Apply the color and transparency.
    const material = new StandardMaterial(`${meshPath}_material`, scene);
    material.diffuseColor = color;
    material.alpha = alpha;

    for (const mesh of meshes) {
      mesh.material = material;
    }
  }
}
