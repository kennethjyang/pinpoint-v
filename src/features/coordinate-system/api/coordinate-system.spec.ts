import { describe, expect, it } from "vitest";
import { addCoordinateSystemTransform } from "./coordinate-system.api";
import { makeCoordinateSystem } from "@/test/fixtures";

describe("addCoordinateSystemTransform", () => {
  it("appends an all-zero, unfixed, unbounded node to the chain", () => {
    const coordinateSystem = makeCoordinateSystem();

    addCoordinateSystemTransform(coordinateSystem);

    expect(coordinateSystem.chain).toHaveLength(2);
    const node = coordinateSystem.chain[1]!;
    expect(node.position.map(value => value.name)).toEqual(["ML", "DV", "AP"]);
    expect(node.rotation.map(value => value.name)).toEqual([
      "Pitch",
      "Yaw",
      "Roll"
    ]);
    for (const value of [...node.position, ...node.rotation]) {
      expect(value.value).toBe(0);
      expect(value.fixed).toBe(false);
      expect(value.bounds).toBeNull();
    }
  });

  it("appends a node to an empty chain", () => {
    const coordinateSystem = makeCoordinateSystem({ chain: [] });

    addCoordinateSystemTransform(coordinateSystem);

    expect(coordinateSystem.chain).toHaveLength(1);
  });
});
