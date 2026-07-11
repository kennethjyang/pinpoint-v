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
    const experiment = ref<Experiment | null>(null);

    /**
     * Create a new experiment with the given name and atlas.
     * @param name Experiment name.
     * @param atlas Full atlas object.
     */
    function create(name: string, atlas: Atlas) {
      experiment.value = { name, atlas };
    }

    /**
     * Get the current experiment name.
     */
    const name = computed(() => experiment.value?.name ?? null);

    /**
     * Get the current experiment atlas.
     */
    const atlas = computed(() => experiment.value?.atlas ?? null);

    return { experiment, create, name, atlas };
  }
);
