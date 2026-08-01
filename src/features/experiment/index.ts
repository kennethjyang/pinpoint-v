export { default as NewExperimentDialog } from "./components/NewExperimentDialog.vue";
export { useExperimentFile } from "./composable/useExperimentFile";
export type { Experiment } from "./models/experiment.model";

export {
  buildExperiment,
  isStructureVisible,
  setStructureVisibility,
  clearVisibleStructures,
  internProbeInterfaceProbe,
  removeInternProbeInterfaceProbe,
  getInternedProbeInterfaceProbe,
  addProbe,
  removeProbe,
  setProbeInterface
} from "./api/experiment.api";
