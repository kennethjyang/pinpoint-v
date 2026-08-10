import type { TransformInputs } from "@/features/scene";

/** A probe's pending pick between two surface-move paths. */
export interface ProbeSurfaceChoice {
  probeId: string;
  /** Probe's transform inputs when the choice was requested, so a moved probe drops it. */
  transformInputs: TransformInputs;
  /** Probe tip when the choice was requested, in atlas ASR mm. */
  tipMillimeters: [number, number, number];
  /** Tip target moving forward along probe-local -Z, in atlas ASR mm. */
  axisTargetMillimeters: [number, number, number];
  /** Tip target moving down on DV (global -Y), in atlas ASR mm. */
  dorsoventralTargetMillimeters: [number, number, number];
}
