import { Atlas } from "@/models/atlas.model";
import {
  ImportMeshAsync,
  Scene,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import axios from "axios";

interface AtlasStructure {
  childrenIds: number[];
}

interface AtlasMetadataResponse {
  rootId: number;
  structures: AtlasStructure[];
}

/**
 * Add the default structures into the scene.
 *
 * These are the first layer of structures under the root.
 *
 * @param atlas Atlas to load structures from.
 * @param scene Babylon scene to put structures into.
 */
export async function loadDefaultStructures(atlas: Atlas, scene: Scene) {
  try {
    // Fetch the atlas metadata file.
    const atlasMetadataResponse = await axios.get<AtlasMetadataResponse>(
      new URL(`${atlas.name}/atlas.json`, atlas.source).toString()
    );

    // Read the structures.
    const { rootId, structures } = atlasMetadataResponse.data;

    // Create a transform node to hold the structures, oriented to match the atlas.
    const rootNode = new TransformNode("atlasRoot_node", scene);
    rootNode.rotation = new Vector3(Math.PI, -Math.PI / 2, 0);

    // Load them into the scene as children of the root node.
    for (const childId of structures[rootId]!.childrenIds) {
      const { meshes } = await ImportMeshAsync(
        new URL(`${atlas.name}/meshes/${childId}.glb`, atlas.source).toString(),
        scene
      );

      if (!meshes[0]) continue;
      meshes[0].parent = rootNode;
    }
  } catch (e) {
    console.error(e);
  }
}
