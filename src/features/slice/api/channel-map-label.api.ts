import type { ProbeShank } from "@/features/probe";
import { clamp } from "@/utils/math";
import type { SampleResult } from "../models/sample-result.model";

/** A channel map's horizontal split into its sampled shank image and its blank label gutter. */
export interface ChannelMapWidths {
  /** Total packed width of every shank, in mm. */
  shankMillimeters: number;
  /** Blank gutter reserved for structure labels, in mm. */
  gutterMillimeters: number;
  /** Fraction of the full width the shank image occupies, measured from the left. */
  imageFraction: number;
}

/** One structure's contiguous vertical run across a channel map's shanks. */
export interface StructureLabelRun {
  /** Annotation value of the structure occupying the run. */
  annotationValue: number;
  /** Fraction down the sampled image the run's midpoint sits at. */
  centerFraction: number;
}

/** Label gutter width, as a multiple of the widest shank's width. */
const LABEL_GUTTER_SHANK_WIDTHS = 2;

/** CSS pixels between a channel map's right edge and its tooltip's left edge. */
const TOOLTIP_GAP_PIXELS = 8;

/**
 * Split a probe's packed shank width into the sampled image and its blank
 * label gutter, sized to the widest shank.
 * @param shanks Probe shanks packed left to right.
 */
export function getChannelMapWidths(shanks: ProbeShank[]): ChannelMapWidths {
  const shankMillimeters = shanks.reduce(
    (total, shank) => total + shank.widthMillimeters,
    0
  );
  if (shankMillimeters <= 0) {
    return { shankMillimeters, gutterMillimeters: 0, imageFraction: 1 };
  }

  const gutterMillimeters =
    LABEL_GUTTER_SHANK_WIDTHS *
    Math.max(0, ...shanks.map(shank => shank.widthMillimeters));
  return {
    shankMillimeters,
    gutterMillimeters,
    imageFraction: shankMillimeters / (shankMillimeters + gutterMillimeters)
  };
}

/**
 * Scan a sample result for every structure's contiguous vertical run across
 * its shanks, as a union over columns.
 * @param result Sampled annotation values to scan.
 */
export function getStructureLabelRuns(
  result: SampleResult
): StructureLabelRun[] {
  const { widthPixels, heightPixels, annotationValues } = result;
  const runs: StructureLabelRun[] = [];
  if (widthPixels <= 0 || heightPixels <= 0) return runs;

  /** Annotation value to the first row of its still-open run. */
  const openRows = new Map<number, number>();
  const rowValues = new Set<number>();

  for (let row = 0; row < heightPixels; row++) {
    rowValues.clear();
    const rowOffset = row * widthPixels;
    for (let column = 0; column < widthPixels; column++) {
      const value = annotationValues[rowOffset + column]!;
      if (value !== 0) rowValues.add(value);
    }

    for (const [value, startRow] of openRows) {
      if (rowValues.has(value)) continue;
      runs.push({
        annotationValue: value,
        centerFraction: (startRow + row) / (2 * heightPixels)
      });
      openRows.delete(value);
    }
    for (const value of rowValues) {
      if (!openRows.has(value)) openRows.set(value, row);
    }
  }

  for (const [value, startRow] of openRows) {
    runs.push({
      annotationValue: value,
      centerFraction: (startRow + heightPixels) / (2 * heightPixels)
    });
  }
  return runs;
}

/**
 * Place a channel map's tooltip just right of its anchor and centred on the
 * pointer, clamped so it stays inside its container.
 * @param anchor Client-space point the tooltip hangs off.
 * @param container Client-space rect the tooltip must stay inside.
 * @param size Measured tooltip size, in CSS pixels.
 */
export function getChannelMapTooltipPosition(
  anchor: { clientX: number; clientY: number },
  container: { left: number; top: number; width: number; height: number },
  size: { width: number; height: number }
): { leftPixels: number; topPixels: number } {
  return {
    leftPixels: clamp(
      anchor.clientX - container.left + TOOLTIP_GAP_PIXELS,
      0,
      Math.max(0, container.width - size.width)
    ),
    topPixels: clamp(
      anchor.clientY - container.top - size.height / 2,
      0,
      Math.max(0, container.height - size.height)
    )
  };
}
