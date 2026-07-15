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
