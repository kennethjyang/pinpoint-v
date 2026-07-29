import { ProbeVisibility } from "../models/visibility.model";
import { InspectableKind } from "@/features/scene";

export interface Probe {
  // Should always be set to "probe".
  inspectableKind: InspectableKind;

  // Unique identifier.
  name: string;

  color: string;
  visibility: ProbeVisibility;

  /**
   * Id into `Experiment.probeInterfaceProbes`, the experiment-local, deduped
   * store of probe interface definitions. Kept as a reference rather than
   * embedding the definition directly so that reactively watching a probe
   * (e.g. for persistence) doesn't have to traverse its definition's
   * thousands of nested contact entries.
   */
  probeInterfaceProbeId: string;

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
