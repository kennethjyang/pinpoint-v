import { describe, expect, it } from "vitest";
import type { SampleResult } from "../models/sample-result.model";
import {
  createSampleResult,
  isSampleResultComplete
} from "./sample-result.api";

function makeResult(overrides: Partial<SampleResult> = {}): SampleResult {
  return {
    widthPixels: 2,
    heightPixels: 2,
    annotationValues: new Uint32Array(4),
    pixels: new Uint8ClampedArray(16),
    paintedChunkCount: 0,
    totalChunkCount: 0,
    ...overrides
  };
}

describe("createSampleResult", () => {
  it("allocates buffers sized to the given dimensions", () => {
    const result = createSampleResult(4, 4);

    expect(result.pixels).toHaveLength(4 * 4 * 4);
    expect(result.annotationValues).toHaveLength(16);
    expect(result.widthPixels).toBe(4);
    expect(result.heightPixels).toBe(4);
  });

  it("allocates independently per axis for a non-square rectangle", () => {
    const result = createSampleResult(4, 16);

    expect(result.annotationValues).toHaveLength(64);
    expect(result.pixels).toHaveLength(64 * 4);
  });

  it("reuses and zeroes a prior result's typed arrays when the sample count matches", () => {
    const previous = createSampleResult(4, 4);
    previous.annotationValues.fill(7);
    previous.pixels.fill(255);

    const result = createSampleResult(4, 4, previous);

    expect(result).not.toBe(previous);
    expect(result.annotationValues).toBe(previous.annotationValues);
    expect(result.pixels).toBe(previous.pixels);
    expect(Array.from(result.annotationValues).every(v => v === 0)).toBe(true);
    expect(Array.from(result.pixels).every(v => v === 0)).toBe(true);
  });

  it("allocates fresh buffers when the prior result's sample count differs", () => {
    const previous = createSampleResult(4, 4);

    const result = createSampleResult(8, 8, previous);

    expect(result.annotationValues).not.toBe(previous.annotationValues);
    expect(result.annotationValues).toHaveLength(64);
  });
});

describe("isSampleResultComplete", () => {
  it("is true when every chunk has been painted", () => {
    const result = makeResult({ paintedChunkCount: 3, totalChunkCount: 3 });
    expect(isSampleResultComplete(result)).toBe(true);
  });

  it("is false when some chunks are still outstanding", () => {
    const result = makeResult({ paintedChunkCount: 1, totalChunkCount: 3 });
    expect(isSampleResultComplete(result)).toBe(false);
  });

  it("is true for a plane with no chunks to paint at all", () => {
    const result = makeResult({ paintedChunkCount: 0, totalChunkCount: 0 });
    expect(isSampleResultComplete(result)).toBe(true);
  });
});
