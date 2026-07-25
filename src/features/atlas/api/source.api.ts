import axios from "axios";
import { Atlas, TerminologyRow } from "@/features/atlas";
import Papa from "papaparse";

/**
 * Atlas item in an atlas source's response structure.
 */
interface AtlasItem {
  name: string;
  type: string;
}

/**
 * Atlas source connection response.
 */
interface AtlasSourceResponse {
  files: AtlasItem[];
}

const BRAINGLOBE_BASE_URL =
  "https://brainglobe.s3.us-west-2.amazonaws.com/atlas-rc2/";
const ATLAS_VERSION_STRING = "3_0";

const TERMINOLOGY_SUFFIX = "-terminology";

/**
 * Fetch and parse the list of atlases available in the BrainGlobe
 * terminology bucket.
 * @returns The parsed atlases, or null if the bucket couldn't be reached.
 */
export async function listAtlases(): Promise<Atlas[] | null> {
  try {
    const bucket = new URL(BRAINGLOBE_BASE_URL);
    const params = new URLSearchParams({
      "list-type": "2",
      prefix: `${bucket.pathname.slice(1)}terminologies/`,
      delimiter: "/"
    });

    const response = await axios.get<string>(`${bucket.origin}/?${params}`, {
      responseType: "text"
    });

    const doc = new DOMParser().parseFromString(
      response.data,
      "application/xml"
    );
    return Array.from(doc.getElementsByTagName("CommonPrefixes"))
      .map(el => el.getElementsByTagName("Prefix")[0]?.textContent ?? "")
      .map(prefix => prefix.split("/").filter(Boolean).pop() ?? "")
      .filter(Boolean)
      .map(name =>
        name.endsWith(TERMINOLOGY_SUFFIX)
          ? name.slice(0, -TERMINOLOGY_SUFFIX.length)
          : name
      )
      .map(name => ({ name, source: BRAINGLOBE_BASE_URL }));
  } catch {
    return null;
  }
}

/**
 * Fetch and parse the list of atlases available in the terminologies
 * directory of a BrainGlobe HTTP server.
 * @param source Root URL of the BrainGlobe HTTP server.
 * @returns The parsed atlases, or null if the host couldn't be reached.
 */
export async function listAtlasesHTTP(source: string): Promise<Atlas[] | null> {
  try {
    const response = await axios.get<AtlasSourceResponse>(
      `${source}/brainglobe-atlasapi/terminologies`
    );

    return response.data.files
      .filter(item => item.type === "folder")
      .map(item =>
        item.name.endsWith(TERMINOLOGY_SUFFIX)
          ? item.name.slice(0, -TERMINOLOGY_SUFFIX.length)
          : item.name
      )
      .map(name => ({ name, source: source }));
  } catch {
    return null;
  }
}

/**
 * Raw terminology row as parsed from CSV, before numeric/array fields are
 * converted from their string representation.
 */
type RawTerminologyRow = Record<keyof TerminologyRow, string>;

/**
 * Convert a raw CSV row into a {@link TerminologyRow}, parsing the numeric
 * and array fields that PapaParse otherwise leaves as strings.
 * @param row Raw CSV row.
 */
function parseTerminologyRow(row: RawTerminologyRow): TerminologyRow {
  let rootIdentifierPath: number[];
  try {
    rootIdentifierPath = JSON.parse(row.root_identifier_path) as number[];
  } catch {
    rootIdentifierPath = [];
  }

  return {
    identifier: Number(row.identifier),
    parent_identifier:
      row.parent_identifier === "" ? null : Number(row.parent_identifier),
    annotation_value: Number(row.annotation_value),
    name: row.name,
    abbreviation: row.abbreviation,
    color_hex_triplet: row.color_hex_triplet,
    root_identifier_path: rootIdentifierPath
  };
}

/**
 * Fetch and parse the terminology list for an atlas.
 * @param atlas Atlas to get the terminology list for and parse.
 * @returns Parsed terminology list, or an empty list if it couldn't be
 * fetched or parsed.
 */
export async function getTerminologyRows(
  atlas: Atlas
): Promise<TerminologyRow[]> {
  return new Promise(resolve => {
    Papa.parse<RawTerminologyRow>(
      new URL(
        `terminologies/${atlas.name}${TERMINOLOGY_SUFFIX}/${ATLAS_VERSION_STRING}/terminology.csv`,
        atlas.source
      ).toString(),
      {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: results => {
          if (results.errors.length > 0) {
            resolve([]);
            return;
          }

          resolve(results.data.map(parseTerminologyRow));
        },
        error: () => resolve([])
      }
    );
  });
}
