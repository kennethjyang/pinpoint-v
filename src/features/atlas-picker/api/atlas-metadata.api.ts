import axios from "axios";
import { Atlas, AtlasMetadata } from "@/models/atlas.model";

/**
 * Fetch the metadata for the given atlas.
 * @param atlas Atlas to fetch the metadata for.
 * @returns The metadata or null if there was a problem fetching.
 */
export async function fetchAtlasMetadata(
  atlas: Atlas
): Promise<AtlasMetadata | null> {
  try {
    const metadataResponse = await axios.get<AtlasMetadata>(
      new URL(`${atlas.name}/atlas.json`, atlas.source).toString()
    );

    return metadataResponse.data;
  } catch {
    return null;
  }
}
