import axios from "axios";
import { Atlas } from "@/features/atlas";

/**
 * Atlas item in an atlas source's response structure.
 */
export interface AtlasItem {
  name: string;
  type: string;
}

/**
 * Atlas source connection response.
 */
export interface AtlasSourceResponse {
  files: AtlasItem[];
}

/**
 * Parse an atlas source's response into the atlases it hosts, dropping any
 * non-folder entries.
 * @param response Raw response from the atlas source.
 * @param source Source URL the response came from.
 */
export function parseAtlasSourceResponse(
  response: AtlasSourceResponse,
  source: string
): Atlas[] {
  return response.files
    .filter(item => item.type === "folder")
    .map(item => ({ name: item.name, source }));
}

/**
 * Connect to an atlas source and fetch the atlases it hosts.
 * @param source Source URL to connect to.
 * @returns The parsed atlases, or null if the source couldn't be reached or
 * returned no data.
 */
export async function fetchAtlasSource(
  source: string
): Promise<Atlas[] | null> {
  try {
    const response = await axios.get<AtlasSourceResponse>(source);
    if (!response.data) return null;

    return parseAtlasSourceResponse(response.data, source);
  } catch {
    return null;
  }
}
