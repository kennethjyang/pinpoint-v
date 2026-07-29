import { Atlas } from "@/features/atlas";
import { Experiment } from "../models/experiment.model";

/**
 * Returns a new experiment with the given name, atlas, and reference coordinate.
 * @param name Experiment name.
 * @param atlas Full atlas object.
 * @param referenceCoordinate Reference coordinate of atlas (in ASR, mm).
 */
export function buildExperiment(
  name: string,
  atlas: Atlas,
  referenceCoordinate: [number, number, number]
): Experiment {
  return {
    name,
    atlas,
    referenceCoordinate,
    visibleStructures: [],
    probeInterfaceProbes: {},
    probes: []
  };
}
