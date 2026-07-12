import {
  ImportMeshAsync,
  Scene,
  TransformNode,
  Vector3
} from "@babylonjs/core";

/**
 * Add the listed meshes into the atlas node.
 *
 * @param paths Path to structure meshes to load.
 * @param scene Babylon scene to put structures into.
 */
export async function loadStructures(paths: string[], scene: Scene) {
  // Create a transform node to hold the structures, oriented to match the atlas.
  const rootNode = new TransformNode("atlasRoot_node", scene);
  rootNode.rotation = new Vector3(Math.PI, -Math.PI / 2, 0);

  // Load them into the scene as children of the root node.
  for (const path of paths) {
    const { meshes } = await ImportMeshAsync(path, scene);

    if (!meshes[0]) continue;
    meshes[0].parent = rootNode;
  }
}
