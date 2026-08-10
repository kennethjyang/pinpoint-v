import { describe, expect, it } from "vitest";
import {
  addCoordinateSystemTransform,
  buildCoordinateSystem,
  buildCoordinateSystemNode,
  buildCoordinateSystemValue,
  buildFixedCoordinateSystemValue
} from "./coordinate-system.api";
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

describe("buildCoordinateSystemValue", () => {
  it("defaults to unbounded, unfixed, zero", () => {
    expect(buildCoordinateSystemValue("ML")).toEqual({
      name: "ML",
      value: 0,
      fixed: false,
      bounds: null
    });
  });

  it("carries an explicit bounds and value", () => {
    expect(buildCoordinateSystemValue("Depth", [-7.5, 7.5], 20)).toEqual({
      name: "Depth",
      value: 20,
      fixed: false,
      bounds: [-7.5, 7.5]
    });
  });
});

describe("buildFixedCoordinateSystemValue", () => {
  it("defaults to an unnamed, unbounded, zero value", () => {
    expect(buildFixedCoordinateSystemValue()).toEqual({
      name: "",
      value: 0,
      fixed: true,
      bounds: null
    });
  });

  it("carries an explicit name and value", () => {
    expect(buildFixedCoordinateSystemValue("Radius", 20)).toEqual({
      name: "Radius",
      value: 20,
      fixed: true,
      bounds: null
    });
  });
});

describe("buildCoordinateSystemNode", () => {
  it("defaults both display orders to identity and passes through the values", () => {
    const position = [
      buildCoordinateSystemValue("ML"),
      buildCoordinateSystemValue("DV"),
      buildCoordinateSystemValue("AP")
    ] satisfies Parameters<typeof buildCoordinateSystemNode>[0];
    const rotation = [
      buildCoordinateSystemValue("Pitch"),
      buildCoordinateSystemValue("Yaw"),
      buildCoordinateSystemValue("Roll")
    ] satisfies Parameters<typeof buildCoordinateSystemNode>[1];

    const node = buildCoordinateSystemNode(position, rotation);

    expect(node.position).toBe(position);
    expect(node.rotation).toBe(rotation);
    expect(node.positionDisplayOrder).toEqual([0, 1, 2]);
    expect(node.rotationDisplayOrder).toEqual([0, 1, 2]);
  });

  it("preserves an explicit display order", () => {
    const node = buildCoordinateSystemNode(
      [
        buildCoordinateSystemValue("ML"),
        buildCoordinateSystemValue("DV"),
        buildCoordinateSystemValue("AP")
      ],
      [
        buildCoordinateSystemValue("Pitch"),
        buildCoordinateSystemValue("Yaw"),
        buildCoordinateSystemValue("Roll")
      ],
      [2, 0, 1]
    );

    expect(node.positionDisplayOrder).toEqual([2, 0, 1]);
    expect(node.rotationDisplayOrder).toEqual([0, 1, 2]);
  });
});

describe("buildCoordinateSystem", () => {
  it("carries the given name, empty chain, and inspectable kind", () => {
    const coordinateSystem = buildCoordinateSystem("CCF", []);

    expect(coordinateSystem.inspectableKind).toBe("coordinateSystem");
    expect(coordinateSystem.name).toBe("CCF");
    expect(coordinateSystem.chain).toEqual([]);
  });

  it("assigns a fresh id on every call", () => {
    expect(buildCoordinateSystem("CCF", []).id).not.toBe(
      buildCoordinateSystem("CCF", []).id
    );
  });
});
