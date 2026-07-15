import { AtlasStructure } from "@/features/atlas";

/**
 * Pinpoint atlas metadata model.
 *
 * Expected shape from atlas sources.
 */
export interface AtlasMetadata {
  name: string;
  version: string;
  resolutions: [number, number, number][];
  dimensions: [number, number, number];
  defaultReferenceCoordinate: [number, number, number];
  rootId: number;
  structures: AtlasStructure[];
}
