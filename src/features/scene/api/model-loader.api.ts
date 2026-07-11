import { Atlas } from "@/models/atlas.model";
import { Scene } from "@babylonjs/core";
import axios from "axios";

/**
 * Add the default structures into the scene.
 *
 * These are the first layer of structures under the root.
 *
 * @param atlas Atlas to load structures from.
 * @param scene Babylon scene to put structures into.
 */
export async function loadDefaultStructures(atlas: Atlas, scene: Scene) {
  // 1. Read the atlas metadata file.
  const atlasMetadataResponse = await axios.get(
    new URL(`${atlas.name}/atlas.json`, atlas.source).toString()
  );
  console.log(atlasMetadataResponse.data);
  console.log(scene);
  // 2. Extract the root structure.
  // 3. Locate the files for the children of the root.
  // 4. Load them into the scene
}
