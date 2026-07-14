import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { Experiment } from "@/models/experiment.model";
import { Atlas } from "@/models/atlas.model";

/**
 * Default reference coordinate for the starter experiment's atlas
 * (`allen_mouse`'s default reference coordinate, in ASR, mm).
 */
const DEFAULT_REFERENCE_COORDINATE: [number, number, number] = [5.7, 0.44, 5.4];

export const useCurrentExperimentStore = defineStore(
  "current-experiment",
  () => {
    /**
     * Current experiment instance.
     */
    const experiment = ref<Experiment>({
      name: "My First Experiment",
      atlas: { source: "http://localhost:3000", name: "allen_mouse" },
      referenceCoordinate: DEFAULT_REFERENCE_COORDINATE,
      visibleStructures: []
    });

    /**
     * Create a new experiment with the given name, atlas, and reference
     * coordinate.
     * @param name Experiment name.
     * @param atlas Full atlas object.
     * @param referenceCoordinate Reference coordinate (in ASR, mm) that the
     * atlas root should be offset by.
     */
    function create(
      name: string,
      atlas: Atlas,
      referenceCoordinate: [number, number, number]
    ) {
      experiment.value = {
        name,
        atlas,
        referenceCoordinate,
        visibleStructures: []
      };
    }

    /**
     * Set the name of the experiment.
     * @param name Experiment name.
     */
    function setName(name: string) {
      if (!experiment.value) return;

      experiment.value.name = name;
    }

    /**
     * Get the current experiment name.
     */
    const name = computed(() => experiment.value?.name ?? null);

    /**
     * Get the current experiment atlas.
     */
    const atlas = computed(() => experiment.value?.atlas ?? null);

    /**
     * Set the reference coordinate of the experiment.
     * @param referenceCoordinate Reference coordinate (in ASR, mm) that the
     * atlas root should be offset by.
     */
    function setReferenceCoordinate(
      referenceCoordinate: [number, number, number]
    ) {
      if (!experiment.value) return;

      experiment.value.referenceCoordinate = referenceCoordinate;
    }

    /**
     * Get the current experiment's reference coordinate.
     */
    const referenceCoordinate = computed(
      () => experiment.value.referenceCoordinate
    );

    /**
     * List of structure ids actively being made shown in the atlas.
     */
    const visibleStructures = computed({
      get: () => experiment.value.visibleStructures,
      set: (value: number[]) => {
        experiment.value.visibleStructures = value;
      }
    });

    /**
     * Is the structure visible on the atlas in the experiment.
     * @param id ID of the structure to check.
     */
    function isStructureVisible(id: number) {
      return experiment.value.visibleStructures.includes(id);
    }

    /**
     * Set the visibility of the structure in the atlas.
     * @param id ID of the structure to set the visibility of.
     * @param value Is the structure visible or not.
     */
    function setStructureVisibility(id: number, value: boolean) {
      if (value) {
        if (!isStructureVisible(id)) {
          experiment.value.visibleStructures.push(id);
        }
      } else {
        const index = experiment.value.visibleStructures.indexOf(id);
        if (index !== -1) {
          experiment.value.visibleStructures.splice(index, 1);
        }
      }
    }

    /**
     * Reset visible structures.
     */
    function clearVisibleStructures() {
      experiment.value.visibleStructures = [];
    }

    return {
      experiment,
      visibleStructures,
      create,
      setName,
      name,
      atlas,
      setReferenceCoordinate,
      referenceCoordinate,
      isStructureVisible,
      setStructureVisibility,
      clearVisibleStructures
    };
  },
  { persist: true }
);
