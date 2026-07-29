import { Atlas } from "@/features/atlas";
import { Experiment } from "@/features/experiment";

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
/**
 * Is the structure visible on the atlas in the experiment.
 * @param experiment Experiment to check visibility in.
 * @param identifier Identifier of the structure to check.
 */
export function isStructureVisible(experiment: Experiment, identifier: number) {
  return experiment.visibleStructures.includes(identifier);
}

/**
 * Set the visibility of the structure in the atlas.
 * @param experiment Experiment to set visibility in.
 * @param identifier Identifier of the structure to set the visibility of.
 * @param value Is the structure visible or not.
 */
export function setStructureVisibility(
  experiment: Experiment,
  identifier: number,
  value: boolean
) {
  if (value) {
    if (!isStructureVisible(experiment, identifier)) {
      experiment.visibleStructures.push(identifier);
    }
  } else {
    const index = experiment.visibleStructures.indexOf(identifier);
    if (index === -1) return;
    experiment.visibleStructures.splice(index, 1);
  }
}

/**
 * Reset visible structures.
 * @param experiment Experiment to clear visible structures in.
 */
export function clearVisibleStructures(experiment: Experiment) {
  experiment.visibleStructures = [];
}
