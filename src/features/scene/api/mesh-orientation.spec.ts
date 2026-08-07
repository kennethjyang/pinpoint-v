import { describe, expect, it } from "vitest";
import { isMeshInsideOut } from "./mesh-orientation.api";

/**
 * Positions for a unit right-angle tetrahedron with vertices at the origin
 * and one unit along each axis.
 */
const TETRAHEDRON_POSITIONS: number[] = [
  0,
  0,
  0, // v0
  1,
  0,
  0, // v1
  0,
  1,
  0, // v2
  0,
  0,
  1 // v3
];

/** Faces wound outward (right-hand rule normal points away from the solid). */
const OUTWARD_INDICES: number[] = [
  0,
  2,
  1, // base, normal -z
  0,
  1,
  3, // normal -y
  0,
  3,
  2, // normal -x
  1,
  2,
  3 // slanted face, normal (1,1,1)
];

/** The same faces with each triangle's last two indices swapped, reversing winding. */
const INWARD_INDICES: number[] = [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2];

describe("isMeshInsideOut", () => {
  it("returns false for a tetrahedron wound with outward-facing normals", () => {
    expect(isMeshInsideOut(TETRAHEDRON_POSITIONS, OUTWARD_INDICES)).toBe(false);
  });

  it("returns true for the same tetrahedron wound with inward-facing normals", () => {
    expect(isMeshInsideOut(TETRAHEDRON_POSITIONS, INWARD_INDICES)).toBe(true);
  });
});
