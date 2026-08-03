import type { Manifest } from "@/features/atlas";
import { getAtlasLongestDimensionMillimeters } from "@/features/atlas";
import type { ProbeContour } from "@/features/probe";
import { clamp } from "@/utils/math";
import type { SampleGeometry } from "../models/sample-geometry.model";
import type { ProbeFrame } from "./probe-frame.api";
import { toAtlasMillimeters } from "./probe-frame.api";

/** Log2 octaves the zoom range spans below its atlas-derived maximum. */
const SLICE_ZOOM_RANGE_OCTAVES = 6;

/**
 * Fallback log2 upper bound when the manifest hasn't resolved, or its
 * dimensions are unknown - the Allen-mouse scale (2^4 = 16mm), which this
 * formula also reproduces once the manifest is available.
 */
const FALLBACK_MAXIMUM_ZOOM_EXPONENT = 4;

/** Device-pixel edge lengths the slice canvas is quantized to. */
const MINIMUM_SIZE_PIXELS = 128;
const MAXIMUM_SIZE_PIXELS = 1024;
const SIZE_QUANTUM_PIXELS = 32;

/** A slice zoom range, as log2 mm exponents. */
export interface SliceZoomExponentRange {
  minimum: number;
  maximum: number;
}

/**
 * Derive the slice zoom range from an atlas's longest dimension, so the
 * range scales with atlas size instead of being tuned to one species - e.g.
 * far too wide for a fly, far too narrow for a human.
 * @param manifest Atlas manifest to derive the range from, or null if not
 *   yet resolved.
 */
export function getSliceZoomExponentRange(
  manifest: Manifest | null
): SliceZoomExponentRange {
  const longestDimensionMillimeters = manifest
    ? getAtlasLongestDimensionMillimeters(manifest)
    : 0;
  const maximum =
    longestDimensionMillimeters > 0
      ? Math.ceil(Math.log2(longestDimensionMillimeters))
      : FALLBACK_MAXIMUM_ZOOM_EXPONENT;
  return { minimum: maximum - SLICE_ZOOM_RANGE_OCTAVES, maximum };
}

/**
 * Clamp a slice extent into a zoom range.
 * @param extentMillimeters Extent to clamp, in mm.
 * @param range Zoom range to clamp into, as log2 mm exponents.
 */
export function clampSliceExtent(
  extentMillimeters: number,
  range: SliceZoomExponentRange
): number {
  return clamp(extentMillimeters, 2 ** range.minimum, 2 ** range.maximum);
}

/**
 * Default slice extent for a probe whose zoom has never been set, in mm -
 * the middle of the atlas's own zoom range, which reproduces the historical
 * 2mm default on the Allen mouse while scaling to any other atlas.
 * @param range Zoom range to take the middle of, as log2 mm exponents.
 */
export function getDefaultSliceExtentMillimeters(
  range: SliceZoomExponentRange
): number {
  return 2 ** ((range.minimum + range.maximum) / 2);
}

/**
 * Build the sampling rectangle through a probe's shanks, centered on a
 * height up its contour from the tip - the square case of {@link SampleGeometry}.
 * @param frame Probe's shank-plane frame.
 * @param centerHeightMillimeters Height up the contour from the tip to center on, in probe-local mm.
 * @param extentMillimeters Edge length of the square rectangle, in mm.
 * @param sizePixels Edge length of the square output, in pixels.
 */
export function getProbeSlicePlane(
  frame: ProbeFrame,
  centerHeightMillimeters: number,
  extentMillimeters: number,
  sizePixels: number
): SampleGeometry {
  return {
    centerMillimeters: toAtlasMillimeters(frame, 0, centerHeightMillimeters),
    rightMillimeters: frame.rightMillimeters,
    upMillimeters: frame.upMillimeters,
    halfWidthMillimeters: extentMillimeters / 2,
    halfHeightMillimeters: extentMillimeters / 2,
    widthPixels: sizePixels,
    heightPixels: sizePixels
  };
}

/**
 * Build the sampling rectangle covering a probe contour's full extent in the
 * shank plane, centered halfway up the contour.
 * @param frame Probe's shank-plane frame.
 * @param contour Probe's contour, whose bounding box the rectangle covers.
 * @param widthPixels Output width, in pixels.
 * @param heightPixels Output height, in pixels.
 */
export function getContourSlicePlane(
  frame: ProbeFrame,
  contour: ProbeContour,
  widthPixels: number,
  heightPixels: number
): SampleGeometry {
  return {
    centerMillimeters: toAtlasMillimeters(
      frame,
      0,
      contour.heightMillimeters / 2
    ),
    rightMillimeters: frame.rightMillimeters,
    upMillimeters: frame.upMillimeters,
    halfWidthMillimeters: contour.widthMillimeters / 2,
    halfHeightMillimeters: contour.heightMillimeters / 2,
    widthPixels,
    heightPixels
  };
}

/**
 * Device-pixel dimensions of a contour-shaped canvas of the given CSS
 * height, quantized along height and widened to the contour's aspect ratio.
 * @param contour Contour whose aspect ratio the output carries.
 * @param cssHeight Canvas height in CSS pixels; 0 while unmeasured.
 * @param pixelRatio Device pixel ratio.
 */
export function getContourSizePixels(
  contour: ProbeContour,
  cssHeight: number,
  pixelRatio: number
): { widthPixels: number; heightPixels: number } {
  if (cssHeight <= 0 || contour.heightMillimeters <= 0) {
    return { widthPixels: 0, heightPixels: 0 };
  }

  const devicePixels = cssHeight * pixelRatio;
  const heightPixels = clamp(
    Math.floor(devicePixels / SIZE_QUANTUM_PIXELS) * SIZE_QUANTUM_PIXELS,
    MINIMUM_SIZE_PIXELS,
    MAXIMUM_SIZE_PIXELS
  );
  const widthPixels = clamp(
    Math.round(
      (heightPixels * contour.widthMillimeters) / contour.heightMillimeters
    ),
    1,
    MAXIMUM_SIZE_PIXELS
  );

  return { widthPixels, heightPixels };
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
  return clamp(centerHeightMillimeters, 0, contour.heightMillimeters);
}

/**
 * Quantize a canvas's device-pixel width into the bounded edge length the
 * slice is sampled at, so small resizes don't trigger a replan.
 * @param cssWidth Canvas element width, in CSS pixels.
 * @param pixelRatio Device pixel ratio.
 */
export function getQuantizedSizePixels(
  cssWidth: number,
  pixelRatio: number
): number {
  if (cssWidth === 0) return 0;
  const devicePixels = cssWidth * pixelRatio;
  const quantized =
    Math.floor(devicePixels / SIZE_QUANTUM_PIXELS) * SIZE_QUANTUM_PIXELS;
  return clamp(quantized, MINIMUM_SIZE_PIXELS, MAXIMUM_SIZE_PIXELS);
}

/**
 * Build the SVG polygon `points` for a contour overlay, re-origined on the
 * slice center height.
 * @param contour Probe contour to render.
 * @param centerHeightMillimeters Height the slice is currently centered on, in probe-local mm.
 */
export function getContourPolygonPoints(
  contour: ProbeContour,
  centerHeightMillimeters: number
): string {
  return contour.points
    .map(({ x, y }) => `${x},${centerHeightMillimeters - y}`)
    .join(" ");
}

/**
 * Map a pointer position to a device-pixel coordinate on the slice canvas,
 * or null when outside the canvas's bounds.
 * @param rect Canvas element's bounding rect.
 * @param clientX Pointer's viewport x coordinate.
 * @param clientY Pointer's viewport y coordinate.
 * @param widthPixels Edge length of the slice along u, in pixels.
 * @param heightPixels Edge length of the slice along v, in pixels.
 */
export function getSlicePixelFromRect(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  widthPixels: number,
  heightPixels: number
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  const x = Math.floor(((clientX - rect.left) / rect.width) * widthPixels);
  const y = Math.floor(((clientY - rect.top) / rect.height) * heightPixels);
  if (x < 0 || y < 0 || x >= widthPixels || y >= heightPixels) return null;
  return { x, y };
}

/**
 * Format a slice extent for display, rounded to avoid runs of float noise.
 * @param extentMillimeters Extent to format, in mm.
 */
export function formatSliceExtentMillimeters(
  extentMillimeters: number
): string {
  return Number(extentMillimeters.toPrecision(2)).toString();
}
