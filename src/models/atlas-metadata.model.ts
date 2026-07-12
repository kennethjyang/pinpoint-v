export interface AtlasStructure {
  name: string;
  acronym: string;
  parentId: number | null;
  childrenIds: number[];
  color: [number, number, number];
}

export interface AtlasMetadata {
  name: string;
  converterVersion: string;
  resolutions: number[];
  rootId: number;
  structures: AtlasStructure[];
}
