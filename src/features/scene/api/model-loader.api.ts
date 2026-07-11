import { Atlas } from "@/models/atlas.model";
import { AppendSceneAsync, Scene } from "@babylonjs/core";
import axios from "axios";

interface AtlasStructure {
  children_ids: number[];
}

interface AtlasMetadataResponse {
  root_id: number;
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
    const { root_id, structures } = atlasMetadataResponse.data;

    // Load them into the scene
    for (const childId of structures[root_id]!.children_ids) {
      await AppendSceneAsync(
        new URL(`${atlas.name}/meshes/${childId}.glb`, atlas.source).toString(),
        scene
      );
    }
  } catch (e) {
    console.error(e);
  }
}
