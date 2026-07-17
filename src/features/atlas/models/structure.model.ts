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
