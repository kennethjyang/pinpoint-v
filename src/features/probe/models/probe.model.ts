import type { SceneModel, TransformInputs } from "@/features/scene";
import type { ProbeVisibility } from "../models/visibility.model";

/**
 * Window along a probe's shanks that the channel map renders, in probe-local
 * mm up from the tip. Keys match Quasar's `QRange` model.
 */
export interface ProbeChannelMapWindow {
  /** Bottom edge of the window, in mm up from the tip. */
  min: number;
  /** Top edge of the window, in mm up from the tip. */
  max: number;
}

export interface Probe {
  inspectableKind: "probe";

  /**
   * Internal unique identifier. A UUID, not user facing.
   */
  id: string;

  /**
   * User-facing label. Need not be unique.
   */
  name: string;

  color: string;
  visibility: ProbeVisibility;

  /**
   * Is the probe locked against pose edits. Locked probes get no transform
   * gizmo and their position/rotation inputs are disabled.
   */
  lock: boolean;

  /**
   * Key into `Experiment.probeInterfaceProbes`, as produced by
   * `getProbeInterfaceIdentifier`.
   */
  probeInterfaceIdentifier: string;

  /**
   * Transform chain the probe's inputs are applied through, by id. Falls back
   * to the built-in default chain when the id names no chain the user has.
   */
  transformChainId: string;

  /**
   * The twelve values the probe's transform chain maps onto its pose: local
   * and global translations in mm, local and global rotations in radians.
   * Translation triples are AP, DV, ML in ASR orientation; rotation triples
   * are roll, yaw, pitch on the same axes. Both are relative to the
   * experiment's reference coordinate.
   *
   * UI may convert this information for different displays.
   */
  transformInputs: TransformInputs;

  /**
   * Edge length of the inspector's slice view, in mm. Null until the user
   * picks a zoom, so the slice view can default it proportionally to the
   * current atlas instead of a fixed value.
   */
  sliceExtentMillimeters: number | null;

  /**
   * Height up the probe contour from the tip that the slice view centers on,
   * in probe-local mm.
   */
  sliceCenterHeightMillimeters: number;

  /**
   * Window along the probe's shanks the channel map renders, in probe-local
   * mm from the tip. Null until the user moves the range, so it defaults to
   * the probe's full contour height.
   */
  channelMapWindow: ProbeChannelMapWindow | null;

  /**
   * Index into the probe's shanks whose tip the transform node aligns with, or
   * null to align on the contour's center.
   */
  shankAlignmentIndex: number | null;

  /**
   * Placement of the 3D model that replaces the probe's head stage and rod, or
   * null to draw the built-in head stage and rod.
   */
  bodyModel: SceneModel | null;
}
