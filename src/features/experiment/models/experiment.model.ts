import { Atlas } from "@/features/atlas";
import { Probe, ProbeInterfaceProbe } from "@/features/probe";

/**
 * A probe interface definition carried by an experiment, addressed by a
 * stable id so the file stays self-contained and portable, and so probes
 * can reference it without duplicating or reactively wrapping its data.
 */
export interface ExperimentProbeInterfaceProbe {
  id: string;
  probeInterfaceProbe: ProbeInterfaceProbe;
}

export interface Experiment {
  name: string;
  atlas: Atlas;

  /**
   * Reference coordinate (in ASR, AP/DV/ML, mm) marking the experiment's
   * landmark of interest within the atlas. Tracked separately from the
   * scene's origin, which is anchored to the atlas center instead.
   */
  referenceCoordinate: [number, number, number];

  /**
   * Identifiers of the atlas structures currently marked visible.
   */
  visibleStructures: number[];

  /**
   * Probe interface definitions used by this experiment's probes, stored
   * once each (deduped) and referenced by id from `Probe.probeInterfaceProbeId`.
   * Carrying these here (rather than only in the probe library) is what
   * makes an experiment self-contained and portable across machines.
   */
  probeInterfaceProbes: ExperimentProbeInterfaceProbe[];

  probes: Probe[];
}
