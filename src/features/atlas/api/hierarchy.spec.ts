import { describe, it, expect } from "vitest";
import { buildHierarchy, flattenHierarchy } from "./hierarchy.api";
import { makeStructures } from "@/test/fixtures";

describe("buildHierarchy", () => {
  it("title-cases the name and upper-cases the acronym", () => {
    const structures = makeStructures({
      0: { name: "primary motor area", acronym: "mop" }
    });

    const node = buildHierarchy(0, structures);

    expect(node?.fullName).toBe("Primary Motor Area");
    expect(node?.acronym).toBe("MOP");
  });

  it("formats color as an rgb() string", () => {
    const structures = makeStructures({ 0: { color: [10, 20, 30] } });

    const node = buildHierarchy(0, structures);

    expect(node?.color).toBe("rgb(10 20 30)");
  });

  it("recurses into childrenIds, nesting descendants", () => {
    const structures = makeStructures();

    const node = buildHierarchy(0, structures);

    expect(node?.children.map(c => c.id)).toEqual([1, 2]);
    expect(node?.children[0]?.children.map(c => c.id)).toEqual([3]);
    expect(node?.children[1]?.children).toEqual([]);
  });

  it("returns null when the id doesn't exist in structures", () => {
    const structures = makeStructures();
    expect(buildHierarchy(999, structures)).toBeNull();
  });

  it("skips (rather than nulls out) missing children via flatMap", () => {
    const structures = makeStructures({
      0: { childrenIds: [1, 999] }
    });

    const node = buildHierarchy(0, structures);

    expect(node?.children.map(c => c.id)).toEqual([1]);
  });
});

describe("flattenHierarchy", () => {
  it("returns an empty list for an empty tree", () => {
    expect(flattenHierarchy([])).toEqual([]);
  });

  it("flattens depth-first, parents before children", () => {
    const structures = makeStructures();
    const root = buildHierarchy(0, structures)!;

    const flat = flattenHierarchy(root.children);

    // root.children = [child-a(1), child-b(2)]; child-a has leaf(3).
    expect(flat.map(n => n.id)).toEqual([1, 3, 2]);
  });
});
