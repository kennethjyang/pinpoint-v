import { describe, expect, it } from "vitest";
import { getProbeContacts, getProbeContour } from "@/features/probe";
import { makeProbe, makeProbeInterfaceProbe } from "@/test/fixtures";
import { getProbeFrame } from "./probe-frame.api";
import {
  SLICE_EXTENTS_MILLIMETERS,
  getDefaultSliceExtentIndex,
  getProbeSlicePlane
} from "./slice-plane.api";

/** Single-shank contour (imec NP1000), in micrometers. */
const NP1000_CONTOUR = [
  [-11, 9989],
  [-11, -11],
  [24, -220],
  [59, -11],
  [59, 9989]
];

describe("getProbeSlicePlane", () => {
  it("centers on the contact bounding box center, not the contour midpoint", () => {
    // A 10mm-tall contour with a single contact 1mm above the tip. Centering
    // on the contour midpoint (y=5) would frame bare shank; centering on the
    // contact (y=1) frames the electrode.
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      probe_planar_contour: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
      ],
      contact_positions: [[5, 1]]
    });
    const contour = getProbeContour(probeInterfaceProbe)!;
    const contacts = getProbeContacts(probeInterfaceProbe)!;
    expect(contour.heightMillimeters / 2).not.toBeCloseTo(
      contacts.centerMillimeters.y,
      3
    );

    const probe = makeProbe({ tipPosition: [0, 0, 0], rotation: [0, 0, 0] });
    const frame = getProbeFrame(probe, [0, 0, 0]);

    const plane = getProbeSlicePlane(frame, contacts, 1, 16);

    // Default rotation [0,0,0]: right = ML (asrToVector3 x), up = DV. The
    // regression this pins: the center must land at the contact's height,
    // not the contour's.
    const contourCenteredPlane = getProbeSlicePlane(
      frame,
      {
        ...contacts,
        centerMillimeters: { x: 0, y: contour.heightMillimeters / 2 }
      },
      1,
      16
    );
    expect(plane.centerMillimeters).not.toEqual(
      contourCenteredPlane.centerMillimeters
    );
  });

  it("sets halfExtentMillimeters to half the given extent", () => {
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      contact_positions: [[0, 0]]
    });
    const contacts = getProbeContacts(probeInterfaceProbe)!;
    const probe = makeProbe();
    const frame = getProbeFrame(probe, [0, 0, 0]);

    const plane = getProbeSlicePlane(frame, contacts, 4, 32);

    expect(plane.halfExtentMillimeters).toBe(2);
    expect(plane.sizePixels).toBe(32);
  });

  it("carries the frame's right and up axes through unchanged", () => {
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      contact_positions: [[0, 0]]
    });
    const contacts = getProbeContacts(probeInterfaceProbe)!;
    const probe = makeProbe({ rotation: [0, 0, Math.PI / 2] });
    const frame = getProbeFrame(probe, [0, 0, 0]);

    const plane = getProbeSlicePlane(frame, contacts, 1, 16);

    expect(plane.rightMillimeters).toEqual(frame.rightMillimeters);
    expect(plane.upMillimeters).toEqual(frame.upMillimeters);
  });
});

describe("getDefaultSliceExtentIndex", () => {
  it("falls back to the mid-ladder default when contacts are null", () => {
    const index = getDefaultSliceExtentIndex(null);

    expect(SLICE_EXTENTS_MILLIMETERS[index]).toBe(2);
  });

  it("returns the smallest ladder entry that fits a tight contact cluster with margin", () => {
    // 0.063mm span * 1.5 margin = 0.0945mm -> smallest ladder entry >= that is 0.25mm.
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      contact_positions: [
        [0, 0],
        [0, 0.063]
      ]
    });
    const contacts = getProbeContacts(probeInterfaceProbe)!;

    expect(getDefaultSliceExtentIndex(contacts)).toBe(0);
    expect(SLICE_EXTENTS_MILLIMETERS[0]).toBe(0.25);
  });

  it("returns a 1mm extent for a ~0.55mm contact span", () => {
    // 0.55mm * 1.5 = 0.825mm -> smallest ladder entry >= that is 1mm.
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      contact_positions: [
        [0, 0],
        [0, 0.55]
      ]
    });
    const contacts = getProbeContacts(probeInterfaceProbe)!;

    expect(getDefaultSliceExtentIndex(contacts)).toBe(
      SLICE_EXTENTS_MILLIMETERS.indexOf(1)
    );
  });

  it("clamps to the largest ladder entry when the target exceeds every rung", () => {
    // 20mm contact span * 1.5 margin = 30mm, larger than the ladder's 16mm
    // max - findIndex returns -1, which must fall back to the last index.
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      contact_positions: [
        [0, 0],
        [0, 20]
      ]
    });
    const contacts = getProbeContacts(probeInterfaceProbe)!;

    expect(getDefaultSliceExtentIndex(contacts)).toBe(
      SLICE_EXTENTS_MILLIMETERS.length - 1
    );
  });

  it("returns the largest ladder entry for a full-length Neuropixels-style contact span", () => {
    // NP1000 contacts run nearly the full ~9.58mm shank length.
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "um",
      probe_planar_contour: NP1000_CONTOUR,
      contact_positions: [
        [0, 20],
        [0, 9580]
      ]
    });
    const contacts = getProbeContacts(probeInterfaceProbe)!;

    expect(getDefaultSliceExtentIndex(contacts)).toBe(
      SLICE_EXTENTS_MILLIMETERS.length - 1
    );
    expect(
      SLICE_EXTENTS_MILLIMETERS[SLICE_EXTENTS_MILLIMETERS.length - 1]
    ).toBe(16);
  });
});
