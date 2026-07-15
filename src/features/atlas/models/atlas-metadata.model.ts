import { AtlasStructure } from "@/features/atlas";

/**
 * Pinpoint atlas metadata model.
 *
 * Expected shape from atlas sources.
 */
export interface AtlasMetadata {
  name: string;
  converterVersion: string;
  resolutions: [number, number, number][];
  defaultReferenceCoordinate: [number, number, number];
  rootId: number;
  structures: AtlasStructure[];
}
