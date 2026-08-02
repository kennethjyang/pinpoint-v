import { describe, expect, it } from "vitest";
import { makeProbeInterfaceProbe } from "@/test/fixtures";
import {
  getProbeContacts,
  getProbeContour,
  getProbeMillimetersPerUnit
} from "./contour.api";

/** Single-shank contour (imec NP1000), in micrometers. */
const NP1000_CONTOUR = [
  [-11, 9989],
  [-11, -11],
  [24, -220],
  [59, -11],
  [59, 9989]
];

describe("getProbeMillimetersPerUnit", () => {
  it("converts meters to millimeters", () => {
    expect(
      getProbeMillimetersPerUnit(makeProbeInterfaceProbe({ si_units: "m" }))
    ).toBe(1000);
  });

  it("keeps millimeters as-is", () => {
    expect(
      getProbeMillimetersPerUnit(makeProbeInterfaceProbe({ si_units: "mm" }))
    ).toBe(1);
  });

  it("converts micrometers to millimeters", () => {
    expect(
      getProbeMillimetersPerUnit(makeProbeInterfaceProbe({ si_units: "um" }))
    ).toBe(1e-3);
  });

  it("falls back to micrometers for an unrecognized unit", () => {
    expect(
      getProbeMillimetersPerUnit(
        makeProbeInterfaceProbe({ si_units: "furlongs" })
      )
    ).toBe(1e-3);
  });
});

describe("getProbeContour", () => {
  it("returns null when there's no contour", () => {
    const result = getProbeContour(makeProbeInterfaceProbe());

    expect(result).toBeNull();
  });

  it("returns null when fewer than 3 points are usable", () => {
    const result = getProbeContour(
      makeProbeInterfaceProbe({
        probe_planar_contour: [
          [0, 0],
          [1, 1]
        ]
      })
    );

    expect(result).toBeNull();
  });

  it("drops non-finite points before checking the minimum point count", () => {
    const result = getProbeContour(
      makeProbeInterfaceProbe({
        probe_planar_contour: [
          [0, 0],
          [1, 1],
          [2, 2],
          [Number.NaN, 3],
          [Number.POSITIVE_INFINITY, 4]
        ]
      })
    );

    expect(result?.points).toHaveLength(3);
  });

  it("scales points to millimeters", () => {
    const result = getProbeContour(
      makeProbeInterfaceProbe({
        si_units: "um",
        probe_planar_contour: NP1000_CONTOUR
      })
    );

    expect(result?.widthMillimeters).toBeCloseTo(0.07, 6);
    expect(result?.heightMillimeters).toBeCloseTo(10.209, 6);
  });

  it("centers x on the bounding box center and zeroes y at the tip", () => {
    const result = getProbeContour(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10]
        ]
      })
    );

    // Bounding box center x = 5, tip (minimum y) = 0.
    expect(result?.points).toEqual([
      { x: -5, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
      { x: -5, y: 10 }
    ]);
    expect(result?.origin).toEqual({ x: 5, y: 0 });
  });

  it("respects si_units when scaling", () => {
    const result = getProbeContour(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: [
          [0, 0],
          [10, 0],
          [5, 10]
        ]
      })
    );

    expect(result?.widthMillimeters).toBe(10);
    expect(result?.heightMillimeters).toBe(10);
  });
});

describe("getProbeContacts", () => {
  it("returns null when there are no usable contact positions", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({ contact_positions: [] })
    );

    expect(result).toBeNull();
  });

  it("returns null when every contact position is non-finite", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        contact_positions: [[Number.NaN, Number.NaN]]
      })
    );

    expect(result).toBeNull();
  });

  it("computes the bounding box center of the contacts, in the contour's frame", () => {
    // Contour origin is x=5 (its bbox center), y=0 (its tip), so contacts at
    // raw x=5..7 land at local x=0..2 rather than being re-centered on 0.
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10]
        ],
        contact_positions: [
          [5, 0],
          [7, 4]
        ]
      })
    );

    expect(result?.centerMillimeters).toEqual({ x: 1, y: 2 });
    expect(result?.widthMillimeters).toBe(2);
    expect(result?.heightMillimeters).toBe(4);
  });

  it("expresses contacts in the contour's frame, not their own", () => {
    // Contour is a 10mm-wide, 10mm-tall square centered at x=5, tip at y=0.
    // A single contact at (5, 1) sits at the contour's horizontal center,
    // 1mm above the tip - it should land at local (0, 1), not (0, 0).
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10]
        ],
        contact_positions: [[5, 1]]
      })
    );

    expect(result?.points).toEqual([{ x: 0, y: 1 }]);
    expect(result?.centerMillimeters).toEqual({ x: 0, y: 1 });
  });

  it("falls back to the contacts' own bounding box when there's no contour", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        contact_positions: [
          [10, 20],
          [12, 24]
        ]
      })
    );

    // No contour to re-origin against, so the fallback frame centers x on
    // the contacts' own bbox (x=11) and takes their lowest y (y=20) as its
    // origin - the same convention getProbeContour uses.
    expect(result?.points).toEqual([
      { x: -1, y: 0 },
      { x: 1, y: 4 }
    ]);
    expect(result?.centerMillimeters).toEqual({ x: 0, y: 2 });
  });

  it("passes shank_ids through, index-aligned with the kept points", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        contact_positions: [
          [0, 0],
          [Number.NaN, 0],
          [1, 1]
        ],
        shank_ids: [0, 0, 1]
      })
    );

    expect(result?.points).toHaveLength(2);
    expect(result?.shankIds).toEqual([0, 1]);
  });

  it("returns null shankIds when shank_ids is absent", () => {
    const result = getProbeContacts(makeProbeInterfaceProbe());

    expect(result?.shankIds).toBeNull();
  });

  it("maps a circle shape to a circle footprint sized from its radius", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "um",
        contact_positions: [[0, 0]],
        contact_shapes: ["circle"],
        contact_shape_params: [{ radius: 6 }]
      })
    );

    expect(result?.shapes[0]).toEqual({
      kind: "circle",
      widthMillimeters: 0.012,
      heightMillimeters: 0.012,
      rotationRadians: 0
    });
  });

  it("falls back a rect's missing height to its width, and vice versa", () => {
    const widthOnly = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "um",
        contact_positions: [[0, 0]],
        contact_shapes: ["rect"],
        contact_shape_params: [{ width: 12 }]
      })
    );
    const heightOnly = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "um",
        contact_positions: [[0, 0]],
        contact_shapes: ["rect"],
        contact_shape_params: [{ height: 15 }]
      })
    );

    expect(widthOnly?.shapes[0]).toEqual({
      kind: "rect",
      widthMillimeters: 0.012,
      heightMillimeters: 0.012,
      rotationRadians: 0
    });
    expect(heightOnly?.shapes[0]).toEqual({
      kind: "rect",
      widthMillimeters: 0.015,
      heightMillimeters: 0.015,
      rotationRadians: 0
    });
  });

  it("maps a rect shape to a rect footprint sized from its width and height", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "um",
        contact_positions: [[0, 0]],
        contact_shapes: ["rect"],
        contact_shape_params: [{ width: 11, height: 15 }]
      })
    );

    expect(result?.shapes[0]).toEqual({
      kind: "rect",
      widthMillimeters: 0.011,
      heightMillimeters: 0.015,
      rotationRadians: 0
    });
  });

  it("maps a square shape to an equal-sided rect footprint", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "um",
        contact_positions: [[0, 0]],
        contact_shapes: ["square"],
        contact_shape_params: [{ width: 12 }]
      })
    );

    expect(result?.shapes[0]).toEqual({
      kind: "rect",
      widthMillimeters: 0.012,
      heightMillimeters: 0.012,
      rotationRadians: 0
    });
  });

  it("falls back to an unrotated square when contact_shapes is missing", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({ contact_positions: [[0, 0]] })
    );

    expect(result?.shapes[0]!.kind).toBe("rect");
    expect(result?.shapes[0]!.widthMillimeters).toBe(
      result?.shapes[0]!.heightMillimeters
    );
    expect(result?.shapes[0]!.rotationRadians).toBe(0);
  });

  it("falls back to an unrotated square for an unrecognized shape kind", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        contact_positions: [[0, 0]],
        contact_shapes: ["hexagon"]
      })
    );

    expect(result?.shapes[0]!.kind).toBe("rect");
    expect(result?.shapes[0]!.widthMillimeters).toBe(
      result?.shapes[0]!.heightMillimeters
    );
  });

  it("derives rotation from contact_plane_axes' u basis vector", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "um",
        contact_positions: [[0, 0]],
        contact_shapes: ["rect"],
        contact_shape_params: [{ width: 10, height: 10 }],
        // 90 degrees: u = (0, 1).
        contact_plane_axes: [
          [
            [0, 1],
            [-1, 0]
          ]
        ]
      })
    );

    expect(result?.shapes[0]!.rotationRadians).toBeCloseTo(Math.PI / 2, 6);
  });

  it("falls back to zero rotation when contact_plane_axes is missing or malformed", () => {
    const missing = getProbeContacts(
      makeProbeInterfaceProbe({ contact_positions: [[0, 0]] })
    );
    const malformed = getProbeContacts(
      makeProbeInterfaceProbe({
        contact_positions: [[0, 0]],
        contact_plane_axes: [[[Number.NaN, 0]]]
      })
    );

    expect(missing?.shapes[0]!.rotationRadians).toBe(0);
    expect(malformed?.shapes[0]!.rotationRadians).toBe(0);
  });

  it("keeps shapes index-aligned with points after dropping non-finite positions", () => {
    const result = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "um",
        contact_positions: [
          [0, 0],
          [Number.NaN, 0],
          [1, 1]
        ],
        contact_shapes: ["circle", "rect", "square"],
        contact_shape_params: [{ radius: 5 }, { width: 10 }, { width: 8 }]
      })
    );

    expect(result?.shapes).toHaveLength(2);
    expect(result?.shapes[0]!.kind).toBe("circle");
    expect(result?.shapes[1]!.kind).toBe("rect");
  });
});
