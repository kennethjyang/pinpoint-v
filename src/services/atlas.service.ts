import { InjectionKey, shallowReadonly, shallowRef, watch } from "vue";
import { AtlasMetadata } from "@/models/atlas-metadata.model";
import { Atlas } from "@/models/atlas.model";
import axios from "axios";

/**
 * Service creator. Hosts the references to the metadata.
 */
export function createAtlasService() {
  const metadata = shallowRef<AtlasMetadata | null>(null);

  /**
   * Build a promise that return an actual instance of the metadata.
   */
  function metadataReady(): Promise<AtlasMetadata> {
    return new Promise(resolve => {
      // Return the existing instance.
      if (metadata.value) {
        resolve(metadata.value);
        return;
      }

      // Wait for one to become available.
      const stop = watch(
        metadata,
        newMetadata => {
          if (newMetadata) {
            stop();
            resolve(newMetadata);
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
   * @param atlas Atlas to use.
   */
  async function setAtlas(atlas: Atlas) {
    // Reset the previous one.
    metadata.value = null;

    // Make a new fetch.
    const metadataResponse = await axios.get<AtlasMetadata>(
      new URL(`${atlas.name}/atlas.json`, atlas.source).toString()
    );

    // Update the value.
    metadata.value = metadataResponse.data;
  }

  return {
    metadata: shallowReadonly(metadata),
    setAtlas,
    metadataReady
  };
}

export type AtlasService = ReturnType<typeof createAtlasService>;

export const AtlasServiceKey: InjectionKey<AtlasService> =
  Symbol("AtlasService");
