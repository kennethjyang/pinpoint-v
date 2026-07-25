import type {
  Atlas,
  AtlasMetadata,
  AtlasStructure,
  TerminologyRow
} from "@/features/atlas";
import type { Experiment } from "@/features/experiment";
import type { ProbeInterfaceProbe } from "@/features/probe";

/**
 * Test fixture factories.
 *
 * Each factory returns a fresh object (no shared references between calls) so
 * tests can freely mutate their own copy. `overrides` are shallow-merged on
 * top of the default shape.
 */

export function makeAtlas(overrides: Partial<Atlas> = {}): Atlas {
  return {
    name: "allen_mouse",
    source: "http://localhost:3000",
    ...overrides
  };
}

/**
 * Build a small root -> children -> grandchildren structure tree, indexed by
 * id (matching the array-indexed access used by the source, e.g.
 * `metadata.structures[id]`).
 *
 * Tree shape: root(0) -> [child-a(1), child-b(2)], child-a(1) -> [leaf(3)].
 */
export function makeStructures(
  overrides: Partial<Record<number, Partial<AtlasStructure>>> = {}
): AtlasStructure[] {
  const structures: AtlasStructure[] = [
    {
      name: "root",
      acronym: "rt",
      parentId: null,
      childrenIds: [1, 2],
      color: [0, 0, 0]
    },
    {
      name: "child a",
      acronym: "ca",
      parentId: 0,
      childrenIds: [3],
      color: [255, 0, 0]
    },
    {
      name: "child b",
      acronym: "cb",
      parentId: 0,
      childrenIds: [],
      color: [0, 255, 0]
    },
    {
      name: "leaf",
      acronym: "lf",
      parentId: 1,
      childrenIds: [],
      color: [0, 0, 255]
    }
  ];

  for (const [id, override] of Object.entries(overrides)) {
    const index = Number(id);
    structures[index] = { ...structures[index]!, ...override };
  }

  return structures;
}

export function makeAtlasMetadata(
  overrides: Partial<AtlasMetadata> = {}
): AtlasMetadata {
  return {
    name: "allen_mouse",
    version: "1.0.0",
    resolutions: [[1, 1, 1]],
    dimensions: [100, 100, 100],
    defaultReferenceCoordinate: [5.7, 0.44, 5.4],
    rootId: 0,
    structures: makeStructures(),
    ...overrides
  };
}

export function makeProbe(
  overrides: Partial<ProbeInterfaceProbe> = {}
): ProbeInterfaceProbe {
  return {
    ndim: 2,
    si_units: "um",
    contact_positions: [[0, 0]],
    annotations: { manufacturer: "cambridgeneurotech", model_name: "ASSY-1" },
    ...overrides
  };
}

export function makeExperiment(
  overrides: Partial<Experiment> = {}
): Experiment {
  return {
    name: "My First Experiment",
    atlas: makeAtlas(),
    referenceCoordinate: [5.7, 0.44, 5.4],
    visibleStructures: [],
    ...overrides
  };
}

export function makeTerminologyRow(
  overrides: Partial<TerminologyRow> = {}
): TerminologyRow {
  return {
    identifier: 997,
    parent_identifier: null,
    annotation_value: 997,
    name: "root",
    abbreviation: "root",
    color_hex_triplet: "#FFFFFF",
    root_identifier_path: [997],
    ...overrides
  };
}

/**
 * Build a small terminology row tree with root-anchored
 * `root_identifier_path`s (the well-formed case, e.g. `allen_mouse`).
 *
 * Tree shape: root(997) -> grey(8) -> [CH(567) -> CTX(688), leaf(700)].
 */
export function makeTerminologyRows(): TerminologyRow[] {
  return [
    makeTerminologyRow({
      identifier: 997,
      parent_identifier: null,
      name: "root",
      abbreviation: "root",
      color_hex_triplet: "#FFFFFF",
      root_identifier_path: [997]
    }),
    makeTerminologyRow({
      identifier: 8,
      parent_identifier: 997,
      annotation_value: 8,
      name: "basic cell groups and regions",
      abbreviation: "grey",
      color_hex_triplet: "#BFDAE3",
      root_identifier_path: [997, 8]
    }),
    makeTerminologyRow({
      identifier: 567,
      parent_identifier: 8,
      annotation_value: 567,
      name: "cerebrum",
      abbreviation: "CH",
      color_hex_triplet: "#B0F0FF",
      root_identifier_path: [997, 8, 567]
    }),
    makeTerminologyRow({
      identifier: 688,
      parent_identifier: 567,
      annotation_value: 688,
      name: "cerebral cortex",
      abbreviation: "CTX",
      color_hex_triplet: "#B0FFB8",
      root_identifier_path: [997, 8, 567, 688]
    }),
    makeTerminologyRow({
      identifier: 700,
      parent_identifier: 8,
      annotation_value: 700,
      name: "leaf",
      abbreviation: "lf",
      color_hex_triplet: "#0000FF",
      root_identifier_path: [997, 8, 700]
    })
  ];
}

/**
 * Build the same tree as {@link makeTerminologyRows}, but with
 * `root_identifier_path`s authored as relative `[parent, self]` pairs
 * instead of full root-anchored paths (the `african_molerat` case). Used to
 * regression-test that `buildHierarchy` relies on `parent_identifier`, not
 * `root_identifier_path`, since the latter drops rows for atlases like this.
 */
export function makeRelativePathTerminologyRows(): TerminologyRow[] {
  return makeTerminologyRows().map(row =>
    row.parent_identifier === null
      ? row
      : {
          ...row,
          root_identifier_path: [row.parent_identifier, row.identifier]
        }
  );
}
