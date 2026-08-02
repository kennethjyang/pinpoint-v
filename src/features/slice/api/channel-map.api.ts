import type { TerminologyRow } from "@/features/atlas";
import type { ProbeContacts, ProbeContour } from "@/features/probe";
import { clamp } from "@/utils/math";
import type { SampleGeometry } from "../models/sample-geometry.model";
import type { SampleResult } from "../models/sample-result.model";
import type { ProbeFrame } from "./probe-frame.api";
import { toAtlasMillimeters } from "./probe-frame.api";
import { quantizeSizePixels } from "./slice-plane.api";

/** Fraction of the contour's width added as margin so its stroke isn't clipped. */
const WIDTH_MARGIN_FRACTION = 0.4;

/** Device-pixel edge lengths the channel map's across-shank axis is quantized to. */
const MINIMUM_WIDTH_PIXELS = 16;
const MAXIMUM_WIDTH_PIXELS = 64;
const WIDTH_QUANTUM_PIXELS = 8;

/** Device-pixel edge lengths the channel map's depth axis is quantized to. */
const MINIMUM_HEIGHT_PIXELS = 128;
const MAXIMUM_HEIGHT_PIXELS = 1024;
const HEIGHT_QUANTUM_PIXELS = 32;

/** Narrowest depth range the range slider may select, in mm. */
const MINIMUM_RANGE_SPAN_MILLIMETERS = 0.05;

/** Fallback color for a band whose annotation value has no matching terminology row. */
const UNKNOWN_BAND_COLOR_HEX_TRIPLET = "#808080";

/** A channel map's visible depth window, in probe-local mm off the tip. */
export interface ChannelMapRange {
  startMillimeters: number;
  endMillimeters: number;
}

/** A contiguous run of rows sharing one region, for the abbreviation column. */
export interface RegionBand {
  annotationValue: number;
  abbreviation: string;
  name: string;
  colorHexTriplet: string;
  startMillimeters: number;
  endMillimeters: number;
  centerMillimeters: number;
}

/** A region band positioned for display, once overlap filtering has resolved its slot. */
export type PositionedRegionBand = RegionBand & { topPixels: number };

/** One contact's SVG footprint in the overlay's probe-local mm space. */
export interface ContactOverlayShape {
  kind: "circle" | "rect";
  centerX: number;
  centerY: number;
  widthMillimeters: number;
  heightMillimeters: number;
  rotationDegrees: number;
}

/**
 * Build the sampling rectangle for a probe's channel map: fixed to the
 * contour's width across the shanks, and to the selected depth range along it.
 * @param frame Probe's shank-plane frame.
 * @param contour Probe's contour, for the fixed across-shank width.
 * @param range Visible depth window, in probe-local mm off the tip.
 * @param widthPixels Edge length of the output along the across-shank axis, in pixels.
 * @param heightPixels Edge length of the output along the depth axis, in pixels.
 */
export function getChannelMapPlane(
  frame: ProbeFrame,
  contour: ProbeContour,
  range: ChannelMapRange,
  widthPixels: number,
  heightPixels: number
): SampleGeometry {
  const centerHeightMillimeters =
    (range.startMillimeters + range.endMillimeters) / 2;

  return {
    centerMillimeters: toAtlasMillimeters(frame, 0, centerHeightMillimeters),
    rightMillimeters: frame.rightMillimeters,
    upMillimeters: frame.upMillimeters,
    halfWidthMillimeters:
      (contour.widthMillimeters * (1 + WIDTH_MARGIN_FRACTION)) / 2,
    halfHeightMillimeters: (range.endMillimeters - range.startMillimeters) / 2,
    widthPixels,
    heightPixels
  };
}

/**
 * Quantize a channel map canvas's device-pixel size into the bounded sample
 * grid it's sampled at, coarser across the shanks than along the depth axis.
 * @param cssWidth Canvas element width, in CSS pixels.
 * @param cssHeight Canvas element height, in CSS pixels.
 * @param pixelRatio Device pixel ratio.
 */
export function getChannelMapSamplePixels(
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number
): { widthPixels: number; heightPixels: number } {
  return {
    widthPixels: quantizeSizePixels(
      cssWidth,
      pixelRatio,
      WIDTH_QUANTUM_PIXELS,
      MINIMUM_WIDTH_PIXELS,
      MAXIMUM_WIDTH_PIXELS
    ),
    heightPixels: quantizeSizePixels(
      cssHeight,
      pixelRatio,
      HEIGHT_QUANTUM_PIXELS,
      MINIMUM_HEIGHT_PIXELS,
      MAXIMUM_HEIGHT_PIXELS
    )
  };
}

/**
 * Clamp a channel map's depth range into a contour's tip-to-top range,
 * enforcing a minimum span so the range slider can never collapse to zero.
 * @param range Range to clamp.
 * @param contour Probe's contour to clamp against.
 */
export function clampChannelMapRange(
  range: ChannelMapRange,
  contour: ProbeContour
): ChannelMapRange {
  const height = contour.heightMillimeters;
  let start = clamp(range.startMillimeters, 0, height);
  let end = clamp(range.endMillimeters, 0, height);
  if (end < start) [start, end] = [end, start];

  if (end - start < MINIMUM_RANGE_SPAN_MILLIMETERS) {
    end = Math.min(height, start + MINIMUM_RANGE_SPAN_MILLIMETERS);
    start = Math.max(0, end - MINIMUM_RANGE_SPAN_MILLIMETERS);
  }

  return { startMillimeters: start, endMillimeters: end };
}

/**
 * Map a probe's contacts to SVG footprints in the overlay's probe-local mm
 * space, dropping any outside the visible depth range.
 * @param contacts Probe's contacts.
 * @param range Visible depth window, in probe-local mm off the tip.
 * @param centerHeightMillimeters Height the overlay is currently centered on, in probe-local mm.
 */
export function getContactOverlayShapes(
  contacts: ProbeContacts,
  range: ChannelMapRange,
  centerHeightMillimeters: number
): ContactOverlayShape[] {
  const shapes: ContactOverlayShape[] = [];
  for (let index = 0; index < contacts.points.length; index++) {
    const point = contacts.points[index]!;
    if (point.y < range.startMillimeters || point.y > range.endMillimeters) {
      continue;
    }

    const shape = contacts.shapes[index]!;
    shapes.push({
      kind: shape.kind,
      centerX: point.x,
      centerY: centerHeightMillimeters - point.y,
      widthMillimeters: shape.widthMillimeters,
      heightMillimeters: shape.heightMillimeters,
      rotationDegrees: (shape.rotationRadians * 180) / Math.PI
    });
  }
  return shapes;
}

/**
 * Run-length encode a sampled channel map's rows into contiguous region
 * bands, from each row's modal non-background annotation value.
 * @param result Sampled channel map result.
 * @param structureIndex Annotation value to terminology row lookup.
 * @param range Visible depth window the result was sampled over, in probe-local mm off the tip.
 */
export function getChannelMapRegionBands(
  result: SampleResult,
  structureIndex: Map<number, TerminologyRow>,
  range: ChannelMapRange
): RegionBand[] {
  const { widthPixels, heightPixels, annotationValues } = result;
  if (heightPixels === 0) return [];

  const stepV = (range.endMillimeters - range.startMillimeters) / heightPixels;
  const bands: RegionBand[] = [];

  let runStartRow = 0;
  let runValue = getRowModalValue(annotationValues, 0, widthPixels);
  for (let row = 1; row <= heightPixels; row++) {
    const value =
      row < heightPixels
        ? getRowModalValue(annotationValues, row, widthPixels)
        : Number.NaN;
    if (value === runValue) continue;

    if (runValue !== 0) {
      bands.push(
        buildRegionBand(
          runValue,
          runStartRow,
          row - 1,
          range,
          stepV,
          structureIndex
        )
      );
    }
    runStartRow = row;
    runValue = value;
  }

  return bands;
}

/**
 * Terminology row for a band's annotation value, or a fallback row's fields
 * when unknown.
 * @param value Row's modal annotation value.
 * @param rowStart First row index of the run, inclusive.
 * @param rowEnd Last row index of the run, inclusive.
 * @param range Visible depth window the result was sampled over, in probe-local mm off the tip.
 * @param stepV Depth spanned by one row, in mm.
 * @param structureIndex Annotation value to terminology row lookup.
 */
function buildRegionBand(
  value: number,
  rowStart: number,
  rowEnd: number,
  range: ChannelMapRange,
  stepV: number,
  structureIndex: Map<number, TerminologyRow>
): RegionBand {
  // Row 0 is the +up edge (largest depth); increasing row moves toward the tip.
  const startMillimeters = range.endMillimeters - (rowEnd + 1) * stepV;
  const endMillimeters = range.endMillimeters - rowStart * stepV;
  const structure = structureIndex.get(value);

  return {
    annotationValue: value,
    abbreviation: structure?.abbreviation ?? "",
    name: structure?.name ?? "",
    colorHexTriplet:
      structure?.color_hex_triplet ?? UNKNOWN_BAND_COLOR_HEX_TRIPLET,
    startMillimeters,
    endMillimeters,
    centerMillimeters: (startMillimeters + endMillimeters) / 2
  };
}

/**
 * Modal non-background annotation value of one sampled row, or 0 when the
 * row is entirely background. Ties break toward whichever value's first
 * occurrence comes first in the row.
 * @param annotationValues Sampled annotation values, row-major.
 * @param row Row index to summarize.
 * @param widthPixels Edge length along the across-shank axis, in pixels.
 */
function getRowModalValue(
  annotationValues: Uint32Array,
  row: number,
  widthPixels: number
): number {
  const counts = new Map<number, number>();
  const offset = row * widthPixels;
  for (let column = 0; column < widthPixels; column++) {
    const value = annotationValues[offset + column]!;
    if (value === 0) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let bestValue = 0;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestValue = value;
    }
  }
  return bestValue;
}

/**
 * Choose which region bands get an abbreviation label without overlapping,
 * preferring larger bands. Labels are placed at each band's center, clamped
 * to fit within the canvas.
 * @param bands Bands to place labels for.
 * @param range Visible depth window the bands were computed over, in probe-local mm off the tip.
 * @param heightPixels Canvas height the labels are positioned within, in pixels.
 * @param labelHeightPixels Height reserved per label, in pixels.
 */
export function selectVisibleBandLabels(
  bands: RegionBand[],
  range: ChannelMapRange,
  heightPixels: number,
  labelHeightPixels: number
): PositionedRegionBand[] {
  const span = range.endMillimeters - range.startMillimeters;
  if (heightPixels <= 0 || span <= 0) return [];

  const candidates = bands
    .map(band => ({
      band,
      topPixels: clamp(
        ((range.endMillimeters - band.centerMillimeters) / span) *
          heightPixels -
          labelHeightPixels / 2,
        0,
        Math.max(0, heightPixels - labelHeightPixels)
      ),
      sizeMillimeters: band.endMillimeters - band.startMillimeters
    }))
    .sort((a, b) => b.sizeMillimeters - a.sizeMillimeters);

  const accepted: { topPixels: number }[] = [];
  const selected: PositionedRegionBand[] = [];
  for (const candidate of candidates) {
    const overlaps = accepted.some(
      other =>
        candidate.topPixels < other.topPixels + labelHeightPixels &&
        other.topPixels < candidate.topPixels + labelHeightPixels
    );
    if (overlaps) continue;

    accepted.push({ topPixels: candidate.topPixels });
    selected.push({ ...candidate.band, topPixels: candidate.topPixels });
  }

  return selected;
}
