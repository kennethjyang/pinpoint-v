import { TerminologyRow } from "@/features/atlas";

/**
 * Presentation-ready tree node built from an {@link AtlasStructure}.
 */
export interface HierarchyModel {
  identifier: number;
  abbreviation: string;
  name: string;
  color: string;
  children: HierarchyModel[];
}

/**
 * Build a tree hierarchy from a structure metadata.
 * @param terminologyRows Parsed terminology rows.
 */
export function buildHierarchy(
  terminologyRows: TerminologyRow[]
): HierarchyModel | null {
  if (terminologyRows.length === 0) return null;

  // Start hierarchy with root.
  const root = terminologyRows.find(row => row.name === "root");
  if (!root) return null;
  const hierarchy: HierarchyModel = {
    identifier: root.identifier,
    abbreviation: root.abbreviation,
    name: root.name,
    color: root.color_hex_triplet,
    children: []
  };

  for (const terminologyRow of terminologyRows) {
    placeTerminologyRow(
      hierarchy,
      terminologyRow,
      terminologyRow.root_identifier_path
    );
  }

  return hierarchy;
}

/**
 * Recursively walk through a terminology hierarchy path and place it into the hierarchy model.
 * @param hierarchyPointer Current node in the hierarchy to build on.
 * @param terminologyRow Terminology row to process.
 * @param remainingPath Current progress through the placement path.
 */
function placeTerminologyRow(
  hierarchyPointer: HierarchyModel,
  terminologyRow: TerminologyRow,
  remainingPath: number[]
) {
  // Exit if path is empty.
  if (remainingPath.length === 0) return;

  // Exit if path start doesn't match hierarchy pointer.
  if (hierarchyPointer.identifier !== remainingPath[0]) return;

  // Base case: if this is the end of the path, fill in the node.
  if (remainingPath.length === 1) {
    hierarchyPointer.abbreviation = terminologyRow.abbreviation;

    // Convert name to title case.
    hierarchyPointer.name = terminologyRow.name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    hierarchyPointer.color = terminologyRow.color_hex_triplet;
    return;
  }

  // Recursive case: continue traversing path.
  if (!remainingPath[1]) return;

  let nextPathNode = hierarchyPointer.children.find(
    child => child.identifier === remainingPath[1]
  );

  // Create the path node if it doesn't exist yet.
  if (!nextPathNode) {
    nextPathNode = {
      identifier: remainingPath[1],
      abbreviation: "",
      name: "",
      color: "",
      children: []
    };
    hierarchyPointer.children.push(nextPathNode);
  }

  // Continue placing.
  placeTerminologyRow(nextPathNode, terminologyRow, remainingPath.slice(1));
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
