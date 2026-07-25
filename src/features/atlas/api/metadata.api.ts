import axios from "axios";
import { Color3 } from "@babylonjs/core";
import { Atlas, AtlasMetadata, StructureEntity } from "@/features/atlas";

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
