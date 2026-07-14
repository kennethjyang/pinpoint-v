import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { Experiment } from "@/models/experiment.model";
import { Atlas } from "@/models/atlas.model";

export const useCurrentExperimentStore = defineStore(
  "current-experiment",
  () => {
    /**
     * Current experiment instance.
     */
    const experiment = ref<Experiment>({
      name: "My First Experiment",
      atlas: { source: "http://localhost:3000", name: "allen_mouse" },
      visibleStructures: []
    });

    /**
     * Create a new experiment with the given name and atlas.
     * @param name Experiment name.
     * @param atlas Full atlas object.
     */
    function create(name: string, atlas: Atlas) {
      experiment.value = { name, atlas, visibleStructures: [] };
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
      isStructureVisible,
      setStructureVisibility,
      clearVisibleStructures
    };
  },
  { persist: true }
);
