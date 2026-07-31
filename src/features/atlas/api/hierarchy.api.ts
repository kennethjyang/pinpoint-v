import { TerminologyRow } from "../models/terminology-row.model";

/**
 * A single indent cell drawn to the left of a row:
 * - `line`  - an ancestor at this level has more siblings below (│)
 * - `blank` - an ancestor at this level was its parent's last child
 * - `tee`   - this row's own connector, more siblings follow (├)
 * - `elbow` - this row's own connector, it is the last child (└)
 */
export type HierarchyGuide = "line" | "blank" | "tee" | "elbow";

/**
 * Presentation-ready row of a DFS-flattened {@link TerminologyRow} hierarchy.
 */
export interface HierarchyItem {
  identifier: number;
  abbreviation: string;
  name: string;
  color: string;
  /**
   * One cell per indent level, outermost first. Length equals the row's
   * depth below the top level; the final entry is always `tee` or `elbow`.
   * Top-level rows get `[]`.
   */
  guides: HierarchyGuide[];
}

/**
 * Convert a terminology name to title case for display.
 * @param name Name to convert.
 */
export function toTitleCase(name: string): string {
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Flatten parsed terminology rows into a DFS pre-order list, linking each row
 * to its parent via `parent_identifier`. The root row itself is excluded.
 *
 * `root_identifier_path` isn't used here: it's not reliably root-anchored
 * across atlases (some author it as relative `[parent, self]` pairs), so
 * relying on it silently drops rows for those atlases.
 * @param terminologyRows Parsed terminology rows.
 */
export function flattenHierarchy(
  terminologyRows: TerminologyRow[]
): HierarchyItem[] {
  const rootRow = terminologyRows.find(row => row.parent_identifier === null);
  if (!rootRow) return [];

  const childrenByParent = new Map<number, TerminologyRow[]>();
  for (const row of terminologyRows) {
    if (row.parent_identifier === null) continue;
    const siblings = childrenByParent.get(row.parent_identifier) ?? [];
    siblings.push(row);
    childrenByParent.set(row.parent_identifier, siblings);
  }

  const items: HierarchyItem[] = [];
  const visited = new Set<number>([rootRow.identifier]);

  // The root itself is never rendered, so its direct children draw no
  // connector to it - they start the tree at `guides: []`.
  function visit(
    parentIdentifier: number,
    prefix: HierarchyGuide[],
    isTopLevel: boolean
  ): void {
    const children = childrenByParent.get(parentIdentifier) ?? [];
    children.forEach((row, index) => {
      if (visited.has(row.identifier)) return;
      visited.add(row.identifier);

      const isLast = index === children.length - 1;
      const guides: HierarchyGuide[] = isTopLevel
        ? []
        : [...prefix, isLast ? "elbow" : "tee"];
      items.push(toItem(row, guides));

      const childPrefix: HierarchyGuide[] = isTopLevel
        ? []
        : [...prefix, isLast ? "blank" : "line"];
      visit(row.identifier, childPrefix, false);
    });
  }

  visit(rootRow.identifier, [], true);
  return items;
}

/**
 * Return the identifiers of the default structures.
 *
 * Currently, this is the identifiers of the direct children of root.
 *
 * @param terminologyRows Parsed terminology rows.
 */
export function getDefaultStructureIdentifiers(
  terminologyRows: TerminologyRow[]
): number[] {
  const rootRow = terminologyRows.find(row => row.parent_identifier === null);
  if (!rootRow) return [];

  return terminologyRows
    .filter(row => row.parent_identifier === rootRow.identifier)
    .map(row => row.identifier);
}

/**
 * Build a {@link HierarchyItem} row from a terminology row.
 * @param terminologyRow Terminology row to convert.
 * @param guides Indent guides for this row, outermost first.
 */
function toItem(
  terminologyRow: TerminologyRow,
  guides: HierarchyGuide[]
): HierarchyItem {
  return {
    identifier: terminologyRow.identifier,
    abbreviation: terminologyRow.abbreviation,
    name: toTitleCase(terminologyRow.name),
    color: terminologyRow.color_hex_triplet,
    guides
  };
}
