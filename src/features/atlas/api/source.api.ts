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

const BRAINGLOBE_BASE_URL =
  "https://brainglobe.s3.us-west-2.amazonaws.com/atlas-rc2/";
const TERMINOLOGY_SUFFIX = "-terminology";

/**
 * Fetch and parse the list of atlas names available in the BrainGlobe
 * terminology bucket.
 */
export async function listAtlases(): Promise<string[]> {
  const bucket = new URL(BRAINGLOBE_BASE_URL);
  const params = new URLSearchParams({
    "list-type": "2",
    prefix: `${bucket.pathname.slice(1)}terminologies/`,
    delimiter: "/"
  });

  const response = await axios.get<string>(`${bucket.origin}/?${params}`, {
    responseType: "text"
  });

  const doc = new DOMParser().parseFromString(response.data, "application/xml");
  return Array.from(doc.getElementsByTagName("CommonPrefixes"))
    .map(el => el.getElementsByTagName("Prefix")[0]?.textContent ?? "")
    .map(prefix => prefix.split("/").filter(Boolean).pop() ?? "")
    .filter(Boolean)
    .map(name =>
      name.endsWith(TERMINOLOGY_SUFFIX)
        ? name.slice(0, -TERMINOLOGY_SUFFIX.length)
        : name
    );
}

/**
 * Fetch and parse the list of atlas names available in the terminologies
 * directory of a BrainGlobe HTTP server.
 * @param host Root URL of the BrainGlobe HTTP server.
 */
export async function listAtlasesHTTP(host: string): Promise<string[]> {
  const response = await axios.get<AtlasSourceResponse>(
    `${host}/brainglobe-atlasapi/terminologies`
  );

  return response.data.files
    .filter(item => item.type === "folder")
    .map(item =>
      item.name.endsWith(TERMINOLOGY_SUFFIX)
        ? item.name.slice(0, -TERMINOLOGY_SUFFIX.length)
        : item.name
    );
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
