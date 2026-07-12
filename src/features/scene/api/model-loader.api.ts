import {
  Color3,
  ImportMeshAsync,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";

/**
 * Add the listed meshes into the atlas node, colored to match the given structure colors.
 *
 * @param structures Path and color for each structure mesh to load.
 * @param scene Babylon scene to put structures into.
 */
export async function setStructures(
  structures: { meshPath: string; color: Color3 }[],
  scene: Scene
) {
  // Reuse the existing root node if present, otherwise create one oriented to match the atlas.
  let rootNode = scene.getTransformNodeByName("atlasRoot_node");
  if (!rootNode) {
    rootNode = new TransformNode("atlasRoot_node", scene);
    rootNode.rotation = new Vector3(Math.PI, -Math.PI / 2, 0);
  } else {
    rootNode.getChildren().forEach(child => child.dispose());
  }

  // Load them into the scene as children of the root node.
  for (const { meshPath, color } of structures) {
    const { meshes } = await ImportMeshAsync(meshPath, scene);

    if (!meshes[0]) continue;
    meshes[0].parent = rootNode;

    // Apply the color and transparency.
    const material = new StandardMaterial(`${meshPath}_material`, scene);
    material.diffuseColor = color;
    material.alpha = 0.2;

    for (const mesh of meshes) {
      mesh.material = material;
    }
  }
}
