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
      atlas: { source: "http://localhost:3000", name: "allen_mouse" }
    });

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

    return { experiment, create, setName, name, atlas };
  },
  { persist: true }
);
