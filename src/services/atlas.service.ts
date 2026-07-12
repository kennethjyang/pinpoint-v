import { InjectionKey, shallowReadonly, shallowRef, watch } from "vue";
import { AtlasMetadata } from "@/models/atlas-metadata.model";
import { Atlas } from "@/models/atlas.model";
import axios from "axios";

/**
 * Service creator. Hosts the references to the metadata.
 */
export function createAtlasService() {
  const atlas = shallowRef<Atlas | null>(null);
  const metadata = shallowRef<AtlasMetadata | null>(null);

  /**
   * Build a promise that return an actual instance of the state.
   */
  function stateReady(): Promise<{
    atlasInstance: Atlas;
    metadataInstance: AtlasMetadata;
  }> {
    return new Promise(resolve => {
      // Return the existing instance.
      if (atlas.value && metadata.value) {
        resolve({
          atlasInstance: atlas.value,
          metadataInstance: metadata.value
        });
        return;
      }

      // Wait for them to become available.
      const stop = watch(
        [atlas, metadata],
        ([newAtlas, newMetadata]) => {
          if (newAtlas && newMetadata) {
            stop();
            resolve({ atlasInstance: newAtlas, metadataInstance: newMetadata });
          }
        },
        { immediate: true }
      );
    });
  }

  /**
   * Set the atlas to use. Set the metadata to use the new atlas.
   *
   * Will throw errors if the metadata fetch fails or the returned data is not the right shape.
   *
   * @param newAtlas Atlas to use.
   */
  async function setAtlas(newAtlas: Atlas) {
    // Reset the previous one.
    atlas.value = null;
    metadata.value = null;

    // Make a new fetch.
    const metadataResponse = await axios.get<AtlasMetadata>(
      new URL(`${newAtlas.name}/atlas.json`, newAtlas.source).toString()
    );

    // Update the value.
    atlas.value = newAtlas;
    metadata.value = metadataResponse.data;
  }

  /**
   * Return the path to the meshes for the default structures.
   */
  async function getDefaultStructuresMeshPaths(): Promise<string[]> {
    const { atlasInstance, metadataInstance } = await stateReady();

    return metadataInstance.structures[
      metadataInstance.rootId
    ]!.childrenIds.map(id =>
      new URL(
        `${atlasInstance.name}/meshes/${id}.glb`,
        atlasInstance.source
      ).toString()
    );
  }

  return {
    metadata: shallowReadonly(metadata),
    stateReady,
    setAtlas,
    getDefaultStructuresMeshPaths
  };
}

export type AtlasService = ReturnType<typeof createAtlasService>;

export const AtlasServiceKey: InjectionKey<AtlasService> =
  Symbol("AtlasService");
