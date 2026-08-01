import { describe, expect, it } from "vitest";
import { getProbeContour } from "@/features/probe";
import { makeProbe, makeProbeInterfaceProbe } from "@/test/fixtures";
import { getProbeFrame } from "./probe-frame.api";
import { clampSliceCenterHeight, getProbeSlicePlane } from "./slice-plane.api";

describe("getProbeSlicePlane", () => {
  it("centers on the given height up the contour from the tip", () => {
    const probe = makeProbe({ tipPosition: [0, 0, 0], rotation: [0, 0, 0] });
    const frame = getProbeFrame(probe, [0, 0, 0]);

    const tipPlane = getProbeSlicePlane(frame, 0, 1, 16);
    const raisedPlane = getProbeSlicePlane(frame, 5, 1, 16);

    // Default rotation [0,0,0]: right = ML (asrToVector3 x), up = DV, so a
    // nonzero center height must shift the plane center along the frame's up
    // axis relative to the tip-centered plane.
    expect(tipPlane.centerMillimeters).not.toEqual(
      raisedPlane.centerMillimeters
    );
    expect(tipPlane.centerMillimeters).toEqual(frame.originMillimeters);
  });

  it("sets halfExtentMillimeters to half the given extent", () => {
    const probe = makeProbe();
    const frame = getProbeFrame(probe, [0, 0, 0]);

    const plane = getProbeSlicePlane(frame, 0, 4, 32);

    expect(plane.halfExtentMillimeters).toBe(2);
    expect(plane.sizePixels).toBe(32);
  });

  it("carries the frame's right and up axes through unchanged", () => {
    const probe = makeProbe({ rotation: [0, 0, Math.PI / 2] });
    const frame = getProbeFrame(probe, [0, 0, 0]);

    const plane = getProbeSlicePlane(frame, 0, 1, 16);

    expect(plane.rightMillimeters).toEqual(frame.rightMillimeters);
    expect(plane.upMillimeters).toEqual(frame.upMillimeters);
  });
});

describe("clampSliceCenterHeight", () => {
  const contour = getProbeContour(
    makeProbeInterfaceProbe({
      si_units: "mm",
      probe_planar_contour: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ]
    })
  )!;

  it("passes through a value already within the contour's range", () => {
    expect(clampSliceCenterHeight(5, contour)).toBe(5);
  });

  it("clamps a negative value up to the tip", () => {
    expect(clampSliceCenterHeight(-3, contour)).toBe(0);
  });

  it("clamps a value above the contour's top down to the top", () => {
    expect(clampSliceCenterHeight(20, contour)).toBe(contour.heightMillimeters);
  });
});
