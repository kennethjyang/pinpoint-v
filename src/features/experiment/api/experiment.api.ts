import { Atlas } from "@/features/atlas";

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
) {
  return {
    name,
    atlas,
    referenceCoordinate,
    visibleStructures: [],
    probeInterfaceProbes: [],
    probes: []
  };
}
