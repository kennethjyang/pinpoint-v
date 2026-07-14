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
      atlas: { source: "http://localhost:8080", name: "allen_mouse" }
    });

    /**
     * List of structure ids actively being made shown in the atlas.
     */
    const visibleStructures = ref<number[]>([]);

    /**
     * Create a new experiment with the given name and atlas.
     * @param name Experiment name.
     * @param atlas Full atlas object.
     */
    function create(name: string, atlas: Atlas) {
      experiment.value = { name, atlas };
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
     * Is the structure visible on the atlas in the experiment.
     * @param id ID of the structure to check.
     */
    function isStructureVisible(id: number) {
      return visibleStructures.value.includes(id);
    }

    /**
     * Set the visibility of the structure in the atlas.
     * @param id ID of the structure to set the visibility of.
     * @param value Is the structure visible or not.
     */
    function setStructureVisibility(id: number, value: boolean) {
      if (value) {
        if (!isStructureVisible(id)) {
          visibleStructures.value.push(id);
        }
      } else {
        const index = visibleStructures.value.indexOf(id);
        if (index !== -1) {
          visibleStructures.value.splice(index, 1);
        }
      }
    }

    /**
     * Reset visible structures.
     */
    function clearVisibleStructures() {
      visibleStructures.value = [];
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
