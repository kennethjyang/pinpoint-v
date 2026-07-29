import type { ProbeVisibility } from "../models/visibility.model";

export interface Probe {
  inspectableKind: "probe";

  // Unique identifier.
  name: string;

  color: string;
  visibility: ProbeVisibility;

  /**
   * Key into `Experiment.probeInterfaceProbes`, as produced by
   * `getProbeIdentifier`.
   */
  probeIdentifier: string;

  /**
   * Internal position representation of the probe tip.
   * - AP, DV, ML order.
   * - ASR orientation.
   * - Relative to atlas origin.
   * - In mm.
   *
   * UI may convert this information for different displays.
   */
  tipPosition: [number, number, number];

  /**
   * Internal orientation representation of the probe.
   * - Roll, yaw, pitch order (aligned to AP, DV, ML order
   * where zero is electrodes facing superior and tip facing anterior).
   * - Pivot on tip.
   * - In radians.
   */
  orientation: [number, number, number];
}
