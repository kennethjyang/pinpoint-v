import { describe, expect, it } from "vitest";
import {
  addCoordinateSystemTransform,
  buildCoordinateSystem,
  buildCoordinateSystemNode,
  buildCoordinateSystemValue,
  buildFixedCoordinateSystemValue,
  getCoordinateSystemAxisValue,
  getCoordinateSystemValueAxis,
  reorderCoordinateSystemValue,
  setCoordinateSystemAxisValue,
  setCoordinateSystemValueAxis,
  setCoordinateSystemValueBounded,
  setCoordinateSystemValueFixed
} from "./coordinate-system.api";
import { makeCoordinateSystem } from "@/test/fixtures";

describe("addCoordinateSystemTransform", () => {
  it("appends an all-zero, unfixed, unbounded node to the chain", () => {
    const coordinateSystem = makeCoordinateSystem();

    addCoordinateSystemTransform(coordinateSystem, "Tip");

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

  it("puts the passed name on the appended node", () => {
    const coordinateSystem = makeCoordinateSystem();

    addCoordinateSystemTransform(coordinateSystem, "Depth");

    expect(coordinateSystem.chain[1]!.name).toBe("Depth");
  });

  it("appends a node to an empty chain", () => {
    const coordinateSystem = makeCoordinateSystem({ chain: [] });

    addCoordinateSystemTransform(coordinateSystem, "Tip");

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
    ] satisfies Parameters<typeof buildCoordinateSystemNode>[1];
    const rotation = [
      buildCoordinateSystemValue("Pitch"),
      buildCoordinateSystemValue("Yaw"),
      buildCoordinateSystemValue("Roll")
    ] satisfies Parameters<typeof buildCoordinateSystemNode>[2];

    const node = buildCoordinateSystemNode("Tip", position, rotation);

    expect(node.position).toBe(position);
    expect(node.rotation).toBe(rotation);
    expect(node.positionDisplayOrder).toEqual([0, 1, 2]);
    expect(node.rotationDisplayOrder).toEqual([0, 1, 2]);
  });

  it("preserves an explicit display order", () => {
    const node = buildCoordinateSystemNode(
      "Tip",
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
    expect(coordinateSystem.offsetByReferenceCoordinate).toBe(false);
  });

  it("carries an explicit offsetByReferenceCoordinate", () => {
    const coordinateSystem = buildCoordinateSystem("CCF", [], true);

    expect(coordinateSystem.offsetByReferenceCoordinate).toBe(true);
  });

  it("assigns a fresh id on every call", () => {
    expect(buildCoordinateSystem("CCF", []).id).not.toBe(
      buildCoordinateSystem("CCF", []).id
    );
  });
});

describe("getCoordinateSystemValueAxis", () => {
  function makeNode() {
    return buildCoordinateSystemNode(
      "Tip",
      [
        buildCoordinateSystemValue("ML"),
        buildCoordinateSystemValue("DV"),
        buildCoordinateSystemValue("AP")
      ],
      [
        buildCoordinateSystemValue("Pitch"),
        buildCoordinateSystemValue("Yaw"),
        buildCoordinateSystemValue("Roll")
      ]
    );
  }

  it("returns the axis a value index resolves to under the default order", () => {
    const node = makeNode();

    expect(getCoordinateSystemValueAxis(node, "position", 1)).toBe(1);
  });

  it("returns the axis a value index resolves to under a permuted order", () => {
    const node = makeNode();
    node.positionDisplayOrder = [2, 0, 1];

    expect(getCoordinateSystemValueAxis(node, "position", 2)).toBe(0);
  });
});

describe("setCoordinateSystemValueAxis", () => {
  function makeNode() {
    return buildCoordinateSystemNode(
      "Tip",
      [
        buildCoordinateSystemValue("ML"),
        buildCoordinateSystemValue("DV"),
        buildCoordinateSystemValue("AP")
      ],
      [
        buildCoordinateSystemValue("Pitch"),
        buildCoordinateSystemValue("Yaw"),
        buildCoordinateSystemValue("Roll")
      ]
    );
  }

  it("swaps the value onto the target axis with whichever value held it", () => {
    const node = makeNode();

    setCoordinateSystemValueAxis(node, "position", 1, 0);

    expect(node.positionDisplayOrder).toEqual([1, 0, 2]);
    expect(new Set(node.positionDisplayOrder).size).toBe(3);
  });

  it("is a no-op when the value already owns the target axis", () => {
    const node = makeNode();

    setCoordinateSystemValueAxis(node, "position", 0, 0);

    expect(node.positionDisplayOrder).toEqual([0, 1, 2]);
  });

  it("leaves the other component's display order untouched", () => {
    const node = makeNode();

    setCoordinateSystemValueAxis(node, "position", 1, 0);

    expect(node.rotationDisplayOrder).toEqual([0, 1, 2]);
  });
});

describe("reorderCoordinateSystemValue", () => {
  function makeNode() {
    return buildCoordinateSystemNode(
      "Tip",
      [
        buildCoordinateSystemValue("ML"),
        buildCoordinateSystemValue("DV"),
        buildCoordinateSystemValue("AP")
      ],
      [
        buildCoordinateSystemValue("Pitch"),
        buildCoordinateSystemValue("Yaw"),
        buildCoordinateSystemValue("Roll")
      ]
    );
  }

  it("moves a value while keeping every axis mapped to the same value", () => {
    const node = makeNode();
    const nameByAxisBefore = [0, 1, 2].map(
      axis => node.position[node.positionDisplayOrder[axis]!]!.name
    );

    reorderCoordinateSystemValue(node, "position", 0, 2);

    expect(node.position.map(value => value.name)).toEqual(["DV", "AP", "ML"]);
    expect(node.positionDisplayOrder).toEqual([2, 0, 1]);
    const nameByAxisAfter = [0, 1, 2].map(
      axis => node.position[node.positionDisplayOrder[axis]!]!.name
    );
    expect(nameByAxisAfter).toEqual(nameByAxisBefore);
  });

  it("is a no-op when fromIndex equals toIndex", () => {
    const node = makeNode();

    reorderCoordinateSystemValue(node, "position", 1, 1);

    expect(node.position.map(value => value.name)).toEqual(["ML", "DV", "AP"]);
    expect(node.positionDisplayOrder).toEqual([0, 1, 2]);
  });

  it("is a no-op for an out-of-range index", () => {
    const node = makeNode();

    reorderCoordinateSystemValue(node, "position", 0, 3);
    reorderCoordinateSystemValue(node, "position", -1, 1);

    expect(node.position.map(value => value.name)).toEqual(["ML", "DV", "AP"]);
    expect(node.positionDisplayOrder).toEqual([0, 1, 2]);
  });
});

describe("setCoordinateSystemValueFixed", () => {
  it("fixes a bounded value and clears its bounds", () => {
    const value = buildCoordinateSystemValue("Depth", [-7.5, 7.5], 3);

    setCoordinateSystemValueFixed(value, true);

    expect(value.fixed).toBe(true);
    expect(value.bounds).toBeNull();
  });

  it("unfixes a value and leaves its bounds null", () => {
    const value = buildFixedCoordinateSystemValue("Radius", 20);

    setCoordinateSystemValueFixed(value, false);

    expect(value.fixed).toBe(false);
    expect(value.bounds).toBeNull();
  });
});

describe("setCoordinateSystemValueBounded", () => {
  it("bounds an unbounded value at zero", () => {
    const value = buildCoordinateSystemValue("ML");

    setCoordinateSystemValueBounded(value, true);

    expect(value.bounds).toEqual([0, 0]);
  });

  it("unbounds a bounded value", () => {
    const value = buildCoordinateSystemValue("Depth", [-7.5, 7.5], 3);

    setCoordinateSystemValueBounded(value, false);

    expect(value.bounds).toBeNull();
  });
});

describe("getCoordinateSystemAxisValue", () => {
  function makeNode() {
    return buildCoordinateSystemNode(
      "Tip",
      [
        buildCoordinateSystemValue("ML", null, 1),
        buildCoordinateSystemValue("DV", null, 2),
        buildCoordinateSystemValue("AP", null, 3)
      ],
      [
        buildCoordinateSystemValue("Pitch", null, 0.1),
        buildCoordinateSystemValue("Yaw", null, 0.2),
        buildCoordinateSystemValue("Roll", null, 0.3)
      ],
      [2, 0, 1]
    );
  }

  it("reads the value mapped onto the given axis under a non-identity order", () => {
    const node = makeNode();

    // positionDisplayOrder [2, 0, 1]: axis 0 <- value 2 (AP=3), axis 1 <- value 0 (ML=1),
    // axis 2 <- value 1 (DV=2).
    expect(getCoordinateSystemAxisValue(node, "position", 0)).toBe(3);
    expect(getCoordinateSystemAxisValue(node, "position", 1)).toBe(1);
    expect(getCoordinateSystemAxisValue(node, "position", 2)).toBe(2);
  });

  it("reads the value mapped onto the given axis under the default rotation order", () => {
    const node = makeNode();

    expect(getCoordinateSystemAxisValue(node, "rotation", 0)).toBeCloseTo(0.1);
    expect(getCoordinateSystemAxisValue(node, "rotation", 1)).toBeCloseTo(0.2);
    expect(getCoordinateSystemAxisValue(node, "rotation", 2)).toBeCloseTo(0.3);
  });
});

describe("setCoordinateSystemAxisValue", () => {
  function makeNode() {
    return buildCoordinateSystemNode(
      "Tip",
      [
        buildCoordinateSystemValue("ML", null, 1),
        buildCoordinateSystemValue("DV", null, 2),
        buildCoordinateSystemValue("AP", null, 3)
      ],
      [
        buildCoordinateSystemValue("Pitch"),
        buildCoordinateSystemValue("Yaw"),
        buildCoordinateSystemValue("Roll")
      ],
      [2, 0, 1]
    );
  }

  it("writes the value mapped onto the given axis under a non-identity order", () => {
    const node = makeNode();

    setCoordinateSystemAxisValue(node, "position", 0, 100);

    // Axis 0 maps to value index 2 (AP) under order [2, 0, 1].
    expect(node.position[2]!.value).toBe(100);
    expect(node.position[0]!.value).toBe(1);
    expect(node.position[1]!.value).toBe(2);
    expect(getCoordinateSystemAxisValue(node, "position", 0)).toBe(100);
  });
});
