import { InjectionKey, shallowReadonly, shallowRef } from "vue";
import { AtlasMetadata } from "@/models/atlas-metadata.model";
import { Atlas } from "@/models/atlas.model";
import axios from "axios";

/**
 * Service creator. Hosts the references to the metadata.
 */
export function createAtlasService() {
  const metadata = shallowRef<AtlasMetadata | null>(null);

  /**
   * Set the atlas to use. Set the metadata to use the new atlas.
   *
   * Will throw errors if the metadata fetch fails or the returned data is not the right shape.
   *
   * @param atlas Atlas to use.
   */
  async function setAtlas(atlas: Atlas) {
    const metadataResponse = await axios.get<AtlasMetadata>(
      new URL(`${atlas.name}/atlas.json`, atlas.source).toString()
    );

    metadata.value = metadataResponse.data;
  }

  return {
    metadata: shallowReadonly(metadata),
    setAtlas
  };
}

export type AtlasService = ReturnType<typeof createAtlasService>;

export const AtlasServiceKey: InjectionKey<AtlasService> =
  Symbol("AtlasService");
