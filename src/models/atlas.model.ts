import { Color3 } from "@babylonjs/core";

/**
 * Atlas identifier.
 */
export interface Atlas {
  name: string;
  source: string;
}

/**
 * Structure 3D mesh entity config for Babylon.
 */
export interface StructureEntity {
  name: string;
  meshPath: string;
  color: Color3;
}

/**
 * Atlas structure subcomponent of metadata.
 */
export interface AtlasStructure {
  name: string;
  acronym: string;
  parentId: number | null;
  childrenIds: number[];
  color: [number, number, number];
}

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
