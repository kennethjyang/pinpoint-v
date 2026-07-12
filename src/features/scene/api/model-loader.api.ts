import {
  ImportMeshAsync,
  Scene,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { useAtlasService } from "@/composable/useAtlasService";

/**
 * Add the default structures into the scene.
 *
 * These are the first layer of structures under the root.
 *
 * @param scene Babylon scene to put structures into.
 */
export async function loadDefaultStructures(scene: Scene) {
  const atlasService = useAtlasService();
  try {
    const structurePaths = await atlasService.getDefaultStructuresMeshPaths();

    // Create a transform node to hold the structures, oriented to match the atlas.
    const rootNode = new TransformNode("atlasRoot_node", scene);
    rootNode.rotation = new Vector3(Math.PI, -Math.PI / 2, 0);

    // Load them into the scene as children of the root node.
    for (const path of structurePaths) {
      const { meshes } = await ImportMeshAsync(path, scene);

      if (!meshes[0]) continue;
      meshes[0].parent = rootNode;
    }
  } catch (e) {
    console.error(e);
  }
}
