import type { ProbeContacts } from "@/features/probe";
import type { PlaneGeometry } from "../models/sample-geometry.model";
import type { ProbeFrame } from "./probe-frame.api";
import { toAtlasMillimeters } from "./probe-frame.api";

/** Discrete square plane extents offered by the slice zoom control, in mm. */
export const SLICE_EXTENTS_MILLIMETERS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;

/** Multiplier applied to a probe's contact span to pick a default extent with margin. */
const DEFAULT_EXTENT_MARGIN = 1.5;

/** Fallback ladder index when a probe has no usable contacts (2mm - the modal bucket across the probeinterface library). */
const FALLBACK_EXTENT_INDEX = SLICE_EXTENTS_MILLIMETERS.indexOf(2);

/**
 * Build the sampling plane through a probe's shanks, centered on its
 * contacts - not on the contour, which spans the whole shank body and is
 * typically dominated by bare shank above and below the electrodes.
 * @param frame Probe's shank-plane frame.
 * @param contacts Probe's contacts in probe-local mm.
 * @param extentMillimeters Edge length of the square plane, in mm.
 * @param sizePixels Edge length of the square output, in pixels.
 */
export function getProbeSlicePlane(
  frame: ProbeFrame,
  contacts: ProbeContacts,
  extentMillimeters: number,
  sizePixels: number
): PlaneGeometry {
  return {
    kind: "plane",
    centerMillimeters: toAtlasMillimeters(
      frame,
      contacts.centerMillimeters.x,
      contacts.centerMillimeters.y
    ),
    rightMillimeters: frame.rightMillimeters,
    upMillimeters: frame.upMillimeters,
    halfExtentMillimeters: extentMillimeters / 2,
    sizePixels
  };
}

/**
 * Ladder index that best frames a probe's contacts, falling back to a
 * mid-ladder default when they're unusable.
 * @param contacts Probe's contacts in probe-local mm, or null when unavailable.
 */
export function getDefaultSliceExtentIndex(
  contacts: ProbeContacts | null
): number {
  if (!contacts) return FALLBACK_EXTENT_INDEX;

  const target =
    DEFAULT_EXTENT_MARGIN *
    Math.max(contacts.widthMillimeters, contacts.heightMillimeters);
  const index = SLICE_EXTENTS_MILLIMETERS.findIndex(extent => extent >= target);
  return index === -1 ? SLICE_EXTENTS_MILLIMETERS.length - 1 : index;
}
