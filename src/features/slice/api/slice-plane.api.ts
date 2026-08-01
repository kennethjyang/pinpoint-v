import type { ProbeContour } from "@/features/probe";
import type { PlaneGeometry } from "../models/sample-geometry.model";
import type { ProbeFrame } from "./probe-frame.api";
import { toAtlasMillimeters } from "./probe-frame.api";

/** Log2 lower bound of the slice zoom range, in mm (2^-2 = 0.25mm). */
export const MINIMUM_SLICE_ZOOM_EXPONENT = -2;

/** Log2 upper bound of the slice zoom range, in mm (2^4 = 16mm). */
export const MAXIMUM_SLICE_ZOOM_EXPONENT = 4;

/**
 * Build the sampling plane through a probe's shanks, centered on a height up
 * its contour from the tip.
 * @param frame Probe's shank-plane frame.
 * @param centerHeightMillimeters Height up the contour from the tip to center on, in probe-local mm.
 * @param extentMillimeters Edge length of the square plane, in mm.
 * @param sizePixels Edge length of the square output, in pixels.
 */
export function getProbeSlicePlane(
  frame: ProbeFrame,
  centerHeightMillimeters: number,
  extentMillimeters: number,
  sizePixels: number
): PlaneGeometry {
  return {
    kind: "plane",
    centerMillimeters: toAtlasMillimeters(frame, 0, centerHeightMillimeters),
    rightMillimeters: frame.rightMillimeters,
    upMillimeters: frame.upMillimeters,
    halfExtentMillimeters: extentMillimeters / 2,
    sizePixels
  };
}

/**
 * Clamp a slice center height into a contour's tip-to-top range.
 * @param centerHeightMillimeters Height up the contour from the tip, in probe-local mm.
 * @param contour Probe's contour to clamp against.
 */
export function clampSliceCenterHeight(
  centerHeightMillimeters: number,
  contour: ProbeContour
): number {
  return Math.min(
    Math.max(centerHeightMillimeters, 0),
    contour.heightMillimeters
  );
}
