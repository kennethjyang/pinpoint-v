export { default as NewExperimentDialog } from "./components/NewExperimentDialog.vue";
export type { Experiment } from "./models/experiment.model";

export {
  buildExperiment,
  isStructureVisible,
  setStructureVisibility,
  clearVisibleStructures,
  internProbeInterfaceProbe,
  getInternedProbeInterfaceProbe,
  addProbe,
  removeProbe
} from "./api/experiment.api";
