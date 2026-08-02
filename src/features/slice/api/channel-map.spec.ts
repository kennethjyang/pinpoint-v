import { describe, expect, it } from "vitest";
import { getProbeContacts, getProbeContour } from "@/features/probe";
import {
  makeProbe,
  makeProbeInterfaceProbe,
  makeTerminologyRow
} from "@/test/fixtures";
import type { SampleResult } from "../models/sample-result.model";
import { buildStructureIndex } from "./structure-colors.api";
import { getProbeFrame } from "./probe-frame.api";
import {
  clampChannelMapRange,
  getChannelMapPlane,
  getChannelMapRegionBands,
  getChannelMapSamplePixels,
  getContactOverlayShapes,
  selectVisibleBandLabels
} from "./channel-map.api";

/** A 10mm-square contour with a single contact 2mm above the tip. */
const CONTOUR = [
  [-5, 0],
  [5, 0],
  [5, 10],
  [-5, 10]
];

function makeContour() {
  return getProbeContour(
    makeProbeInterfaceProbe({ si_units: "mm", probe_planar_contour: CONTOUR })
  )!;
}

describe("getChannelMapPlane", () => {
  it("centers the rectangle on the range's midpoint", () => {
    const probe = makeProbe({ tipPosition: [0, 0, 0], rotation: [0, 0, 0] });
    const frame = getProbeFrame(probe, [0, 0, 0]);
    const contour = makeContour();

    const plane = getChannelMapPlane(
      frame,
      contour,
      { startMillimeters: 2, endMillimeters: 6 },
      16,
      64
    );

    expect(plane.halfHeightMillimeters).toBe(2);
    expect(plane.centerMillimeters).not.toEqual(frame.originMillimeters);
  });

  it("sizes the width from the contour plus margin, independent of the range", () => {
    const probe = makeProbe();
    const frame = getProbeFrame(probe, [0, 0, 0]);
    const contour = makeContour();

    const narrow = getChannelMapPlane(
      frame,
      contour,
      { startMillimeters: 0, endMillimeters: 1 },
      16,
      64
    );
    const wide = getChannelMapPlane(
      frame,
      contour,
      { startMillimeters: 0, endMillimeters: 10 },
      16,
      64
    );

    expect(narrow.halfWidthMillimeters).toBe(wide.halfWidthMillimeters);
    expect(narrow.halfWidthMillimeters).toBeGreaterThan(
      contour.widthMillimeters / 2
    );
  });

  it("carries the frame's right and up axes through unchanged", () => {
    const probe = makeProbe({ rotation: [0, 0, Math.PI / 2] });
    const frame = getProbeFrame(probe, [0, 0, 0]);
    const contour = makeContour();

    const plane = getChannelMapPlane(
      frame,
      contour,
      { startMillimeters: 0, endMillimeters: 5 },
      16,
      64
    );

    expect(plane.rightMillimeters).toEqual(frame.rightMillimeters);
    expect(plane.upMillimeters).toEqual(frame.upMillimeters);
  });
});

describe("getChannelMapSamplePixels", () => {
  it("returns 0 for both axes when the canvas has no size yet", () => {
    expect(getChannelMapSamplePixels(0, 0, 2)).toEqual({
      widthPixels: 0,
      heightPixels: 0
    });
  });

  it("quantizes each axis to its own bounds", () => {
    const { widthPixels, heightPixels } = getChannelMapSamplePixels(
      200,
      2000,
      1
    );

    expect(widthPixels).toBeLessThanOrEqual(64);
    expect(heightPixels).toBeGreaterThan(widthPixels);
  });
});

describe("clampChannelMapRange", () => {
  const contour = makeContour();

  it("passes through a range already within the contour's height", () => {
    expect(
      clampChannelMapRange({ startMillimeters: 2, endMillimeters: 6 }, contour)
    ).toEqual({ startMillimeters: 2, endMillimeters: 6 });
  });

  it("clamps both ends into [0, contour height]", () => {
    expect(
      clampChannelMapRange(
        { startMillimeters: -5, endMillimeters: 999 },
        contour
      )
    ).toEqual({
      startMillimeters: 0,
      endMillimeters: contour.heightMillimeters
    });
  });

  it("swaps a start above the end", () => {
    expect(
      clampChannelMapRange({ startMillimeters: 8, endMillimeters: 2 }, contour)
    ).toEqual({ startMillimeters: 2, endMillimeters: 8 });
  });

  it("enforces a minimum span for a collapsed range", () => {
    const result = clampChannelMapRange(
      { startMillimeters: 5, endMillimeters: 5 },
      contour
    );

    expect(result.endMillimeters - result.startMillimeters).toBeGreaterThan(0);
  });
});

describe("getContactOverlayShapes", () => {
  it("includes a contact within the visible range", () => {
    const contacts = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: CONTOUR,
        contact_positions: [[0, 2]]
      })
    )!;

    const shapes = getContactOverlayShapes(
      contacts,
      { startMillimeters: 0, endMillimeters: 4 },
      2
    );

    expect(shapes).toHaveLength(1);
  });

  it("culls a contact outside the visible range", () => {
    const contacts = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: CONTOUR,
        contact_positions: [
          [0, 2],
          [0, 8]
        ]
      })
    )!;

    const shapes = getContactOverlayShapes(
      contacts,
      { startMillimeters: 0, endMillimeters: 4 },
      2
    );

    expect(shapes).toHaveLength(1);
  });

  it("re-origins on the overlay's center height, mirroring the contour overlay's convention", () => {
    const contacts = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: CONTOUR,
        contact_positions: [[0, 2]]
      })
    )!;

    const shapes = getContactOverlayShapes(
      contacts,
      { startMillimeters: 0, endMillimeters: 4 },
      2
    );

    expect(shapes[0]!.centerY).toBe(0);
  });

  it("converts each contact's rotation to degrees", () => {
    const contacts = getProbeContacts(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: CONTOUR,
        contact_positions: [[0, 2]],
        contact_shapes: ["rect"],
        contact_shape_params: [{ width: 1, height: 1 }],
        contact_plane_axes: [
          [
            [0, 1],
            [-1, 0]
          ]
        ]
      })
    )!;

    const shapes = getContactOverlayShapes(
      contacts,
      { startMillimeters: 0, endMillimeters: 4 },
      2
    );

    expect(shapes[0]!.rotationDegrees).toBeCloseTo(90, 6);
  });
});

function makeResult(
  widthPixels: number,
  heightPixels: number,
  annotationValues: number[]
): SampleResult {
  return {
    widthPixels,
    heightPixels,
    annotationValues: Uint32Array.from(annotationValues),
    pixels: new Uint8ClampedArray(widthPixels * heightPixels * 4),
    paintedChunkCount: 1,
    totalChunkCount: 1
  };
}

describe("getChannelMapRegionBands", () => {
  const structureIndex = buildStructureIndex([
    makeTerminologyRow({
      annotation_value: 8,
      abbreviation: "grey",
      name: "basic cell groups and regions"
    }),
    makeTerminologyRow({
      annotation_value: 9,
      abbreviation: "wm",
      name: "white matter"
    })
  ]);

  it("encodes a single uniform region as one band spanning the whole range", () => {
    const result = makeResult(1, 4, [8, 8, 8, 8]);

    const bands = getChannelMapRegionBands(result, structureIndex, {
      startMillimeters: 0,
      endMillimeters: 4
    });

    expect(bands).toHaveLength(1);
    expect(bands[0]!.annotationValue).toBe(8);
    expect(bands[0]!.startMillimeters).toBe(0);
    expect(bands[0]!.endMillimeters).toBe(4);
  });

  it("splits into contiguous bands per distinct row value, row 0 at the +up (end) edge", () => {
    // Row 0 is nearest endMillimeters (4), row 3 nearest startMillimeters (0)
    // - bands are emitted in row order, so the band nearest the end comes first.
    const result = makeResult(1, 4, [9, 9, 8, 8]);

    const bands = getChannelMapRegionBands(result, structureIndex, {
      startMillimeters: 0,
      endMillimeters: 4
    });

    expect(bands).toHaveLength(2);
    expect(bands[0]!.annotationValue).toBe(9);
    expect(bands[0]!.startMillimeters).toBe(2);
    expect(bands[0]!.endMillimeters).toBe(4);
    expect(bands[1]!.annotationValue).toBe(8);
    expect(bands[1]!.startMillimeters).toBe(0);
    expect(bands[1]!.endMillimeters).toBe(2);
  });

  it("omits background-only rows", () => {
    const result = makeResult(1, 2, [0, 0]);

    const bands = getChannelMapRegionBands(result, structureIndex, {
      startMillimeters: 0,
      endMillimeters: 2
    });

    expect(bands).toEqual([]);
  });

  it("resolves multi-shank disagreement at one depth by the row's modal value", () => {
    // 2 columns wide: row 0 has two votes for 8, one for 9.
    const result = makeResult(3, 1, [8, 8, 9]);

    const bands = getChannelMapRegionBands(result, structureIndex, {
      startMillimeters: 0,
      endMillimeters: 1
    });

    expect(bands).toHaveLength(1);
    expect(bands[0]!.annotationValue).toBe(8);
  });

  it("falls back to blank fields for an annotation value with no matching terminology row", () => {
    const result = makeResult(1, 1, [999]);

    const bands = getChannelMapRegionBands(result, structureIndex, {
      startMillimeters: 0,
      endMillimeters: 1
    });

    expect(bands[0]!.abbreviation).toBe("");
    expect(bands[0]!.colorHexTriplet).toMatch(/^#/);
  });
});

describe("selectVisibleBandLabels", () => {
  it("keeps a single band's label", () => {
    const bands = [
      {
        annotationValue: 8,
        abbreviation: "grey",
        name: "grey",
        colorHexTriplet: "#ffffff",
        startMillimeters: 0,
        endMillimeters: 4,
        centerMillimeters: 2
      }
    ];

    const selected = selectVisibleBandLabels(
      bands,
      { startMillimeters: 0, endMillimeters: 4 },
      100,
      20
    );

    expect(selected).toHaveLength(1);
  });

  it("drops the smaller of two overlapping bands' labels", () => {
    const big = {
      annotationValue: 8,
      abbreviation: "big",
      name: "big",
      colorHexTriplet: "#ffffff",
      startMillimeters: 0,
      endMillimeters: 4,
      centerMillimeters: 2
    };
    const small = {
      annotationValue: 9,
      abbreviation: "small",
      name: "small",
      colorHexTriplet: "#ffffff",
      // Center close enough to `big`'s that their labels collide.
      startMillimeters: 1.9,
      endMillimeters: 2.1,
      centerMillimeters: 2
    };

    const selected = selectVisibleBandLabels(
      [big, small],
      { startMillimeters: 0, endMillimeters: 4 },
      100,
      50
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]!.abbreviation).toBe("big");
  });

  it("returns no labels for a degenerate range", () => {
    const bands = [
      {
        annotationValue: 8,
        abbreviation: "grey",
        name: "grey",
        colorHexTriplet: "#ffffff",
        startMillimeters: 0,
        endMillimeters: 0,
        centerMillimeters: 0
      }
    ];

    expect(
      selectVisibleBandLabels(
        bands,
        { startMillimeters: 3, endMillimeters: 3 },
        100,
        20
      )
    ).toEqual([]);
  });
});
