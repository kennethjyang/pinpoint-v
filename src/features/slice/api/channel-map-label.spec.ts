import { describe, expect, it } from "vitest";
import type { ProbeShank } from "@/features/probe";
import type { SampleResult } from "../models/sample-result.model";
import {
  getChannelMapTooltipPosition,
  getChannelMapWidths,
  getStructureLabelRuns
} from "./channel-map-label.api";

/**
 * Build a fixture shank with just the width `getChannelMapWidths` reads.
 * @param widthMillimeters Full x extent of the shank's outline, in mm.
 */
function makeShank(widthMillimeters: number): ProbeShank {
  return {
    id: null,
    rings: [],
    contacts: [],
    minimumXMillimeters: 0,
    maximumXMillimeters: widthMillimeters,
    widthMillimeters
  };
}

/**
 * Build a fixture sample result from a row-major annotation value grid.
 * @param widthPixels Edge length along u, in pixels.
 * @param heightPixels Edge length along v, in pixels.
 * @param annotationValues Row-major annotation values, one per sample.
 */
function makeSampleResult(
  widthPixels: number,
  heightPixels: number,
  annotationValues: number[] = []
): SampleResult {
  const values = new Uint32Array(widthPixels * heightPixels);
  values.set(annotationValues);
  return {
    widthPixels,
    heightPixels,
    annotationValues: values,
    pixels: new Uint8ClampedArray(widthPixels * heightPixels * 4),
    paintedChunkCount: 1,
    totalChunkCount: 1
  };
}

describe("getChannelMapWidths", () => {
  it("splits two equal-width shanks into a gutter twice as wide", () => {
    const widths = getChannelMapWidths([makeShank(0.1), makeShank(0.1)]);

    expect(widths).toEqual({
      shankMillimeters: 0.2,
      gutterMillimeters: 0.2,
      imageFraction: 0.5
    });
  });

  it("sizes the gutter off the widest shank when shanks differ", () => {
    const widths = getChannelMapWidths([makeShank(0.05), makeShank(0.2)]);

    expect(widths.shankMillimeters).toBeCloseTo(0.25);
    expect(widths.gutterMillimeters).toBeCloseTo(0.4);
  });

  it("returns an un-gutted, full-width split for an empty shank array", () => {
    expect(getChannelMapWidths([])).toEqual({
      shankMillimeters: 0,
      gutterMillimeters: 0,
      imageFraction: 1
    });
  });
});

describe("getStructureLabelRuns", () => {
  it("centers a single-column run on its vertical midpoint", () => {
    const annotationValues = Array.from({ length: 8 }, () => 0);
    for (let row = 2; row <= 5; row++) annotationValues[row] = 9;

    const runs = getStructureLabelRuns(
      makeSampleResult(1, 8, annotationValues)
    );

    expect(runs).toEqual([{ annotationValue: 9, centerFraction: 0.5 }]);
  });

  it("unions a value across shank columns in the same row into one run", () => {
    // 2 columns x 4 rows; value 5 occupies column 0 on row 0 and column 1 on row 1.
    const annotationValues = [5, 0, 0, 5, 0, 0, 0, 0];

    const runs = getStructureLabelRuns(
      makeSampleResult(2, 4, annotationValues)
    );

    expect(runs).toEqual([{ annotationValue: 5, centerFraction: 0.25 }]);
  });

  it("splits a run interrupted by a gap row into two runs with distinct centres", () => {
    // 1 column x 5 rows; value 3 on rows 0-1, absent on row 2, present on rows 3-4.
    const annotationValues = [3, 3, 0, 3, 3];

    const runs = getStructureLabelRuns(
      makeSampleResult(1, 5, annotationValues)
    );

    expect(runs).toEqual([
      { annotationValue: 3, centerFraction: 0.2 },
      { annotationValue: 3, centerFraction: 0.8 }
    ]);
  });

  it("flushes a run that reaches the last row", () => {
    const annotationValues = [0, 7, 7, 7];

    const runs = getStructureLabelRuns(
      makeSampleResult(1, 4, annotationValues)
    );

    expect(runs).toEqual([{ annotationValue: 7, centerFraction: 0.625 }]);
  });

  it("returns no runs for an all-zero image", () => {
    expect(getStructureLabelRuns(makeSampleResult(3, 3)).length).toBe(0);
  });

  it("returns no runs for a 0x0 result", () => {
    expect(getStructureLabelRuns(makeSampleResult(0, 0)).length).toBe(0);
  });
});

describe("getChannelMapTooltipPosition", () => {
  const container = { left: 100, top: 50, width: 400, height: 300 };
  const size = { width: 60, height: 20 };

  it("places the tooltip right of the anchor, centred on it vertically", () => {
    const position = getChannelMapTooltipPosition(
      { clientX: 150, clientY: 120 },
      container,
      size
    );

    expect(position.leftPixels).toBe(150 - container.left + 8);
    expect(position.topPixels).toBe(120 - container.top - size.height / 2);
  });

  it("clamps the top to the container's bottom edge when the tooltip would overflow", () => {
    const position = getChannelMapTooltipPosition(
      { clientX: 150, clientY: 349 },
      container,
      size
    );

    expect(position.topPixels).toBe(container.height - size.height);
  });

  it("clamps the left to the container's right edge when the anchor is past it", () => {
    const position = getChannelMapTooltipPosition(
      { clientX: 600, clientY: 120 },
      container,
      size
    );

    expect(position.leftPixels).toBe(container.width - size.width);
  });

  it("clamps to zero when the tooltip is larger than the container", () => {
    const position = getChannelMapTooltipPosition(
      { clientX: 90, clientY: 40 },
      container,
      { width: 500, height: 400 }
    );

    expect(position.leftPixels).toBe(0);
    expect(position.topPixels).toBe(0);
  });
});
