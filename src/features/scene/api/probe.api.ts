import type { Experiment } from "@/features/experiment";
import type { Probe } from "@/features/probe";
import type { Scene } from "@babylonjs/core";

/**
 * Build the probe entity and add it to the scene.
 *
 * The entity is identified by the probe's UUID.
 * @param scene Scene to add the probe to.
 * @param probe Probe to build.
 * @param experiment Experiment this probe belongs to (to extract probe interface definition).
 */
export function buildProbe(scene: Scene, probe: Probe, experiment: Experiment) {
  console.log(scene);
  console.log(probe);
  console.log(experiment);
}
