import { AtlasStructure } from "@/features/atlas";

/**
 * Presentation-ready tree node built from an {@link AtlasStructure}.
 */
export interface HierarchyModel {
  id: number;
  acronym: string;
  fullName: string;
  color: string;
  children: HierarchyModel[];
}

/**
 * Build a tree hierarchy from a structure metadata.
 * @param id Index of the current structure in `structures` to recurse down.
 * @param structures All structures in atlas metadata.
 */
export function buildHierarchy(
  id: number,
  structures: AtlasStructure[]
): HierarchyModel | null {
  // Get the structure.
  const structure = structures[id];
  if (!structure) return null;

  // Convert name to title case.
  const titleCaseName = structure.name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return {
    id,
    acronym: structure.acronym.toUpperCase(),
    fullName: titleCaseName,
    color: `rgb(${structure.color[0]} ${structure.color[1]} ${structure.color[2]})`,
    children: structure.childrenIds.flatMap(
      childId => buildHierarchy(childId, structures) ?? []
    )
  };
}

/**
 * Flatten a hierarchy tree into a depth-first list of nodes (parents appear
 * before their children).
 * @param nodes Root-level nodes to flatten.
 */
export function flattenHierarchy(nodes: HierarchyModel[]): HierarchyModel[] {
  const flattened: HierarchyModel[] = [];
  const walk = (level: HierarchyModel[]) => {
    for (const node of level) {
      flattened.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return flattened;
}
