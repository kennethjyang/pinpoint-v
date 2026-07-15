import axios from "axios";
import semver from "semver";
import { Color3 } from "@babylonjs/core";
import {
  Atlas,
  AtlasMetadata,
  ConverterCompatibility,
  StructureEntity
} from "@/features/atlas";

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

/**
 * Get the default (top-level) structure ids for an atlas, i.e. the children
 * of the root structure.
 * @param metadata Atlas metadata to get the default structure ids from.
 */
export function getDefaultStructureIds(metadata: AtlasMetadata): number[] {
  return metadata.structures[metadata.rootId]?.childrenIds ?? [];
}

/**
 * Build the structure entity model from a structure ID.
 * @param atlas Atlas the structure belongs to.
 * @param metadata Atlas metadata to look the structure up in.
 * @param id ID of the structure to build the model for.
 * @returns The built structure model or null if the id doesn't exist in the
 * metadata.
 */
export function structureEntityFromId(
  atlas: Atlas,
  metadata: AtlasMetadata,
  id: number
): StructureEntity | null {
  // Get the structure.
  const structure = metadata.structures[id];
  if (!structure) return null;

  // Extract color.
  const [r, g, b] = structure.color;

  // Build model.
  return {
    name: id.toString(),
    meshPath: new URL(
      `${atlas.name}/meshes/${id}.glb`,
      atlas.source
    ).toString(),
    color: Color3.FromInts(r, g, b)
  };
}

/**
 * Check whether an atlas's version is compatible with the running Pinpoint version.
 * @param atlasVersion Atlas version from the atlas's metadata.
 * @param appVersion Current Pinpoint version.
 */
export function checkAtlasCompatibility(
  atlasVersion: string | undefined,
  appVersion: string
): ConverterCompatibility {
  const converter = atlasVersion ? semver.coerce(atlasVersion) : null;
  const app = semver.coerce(appVersion);
  if (!converter || !app) return ConverterCompatibility.Unverifiable;

  if (app.major < converter.major) {
    return ConverterCompatibility.BlockPinpointOutdated;
  }
  if (app.major > converter.major) {
    return ConverterCompatibility.BlockAtlasOutdated;
  }
  if (app.minor > converter.minor) return ConverterCompatibility.Warn;

  return ConverterCompatibility.Compatible;
}
