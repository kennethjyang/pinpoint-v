import type { Atlas, AtlasMetadata, AtlasStructure } from "@/features/atlas";
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
