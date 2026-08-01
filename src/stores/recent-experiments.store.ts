import { defineStore } from "pinia";
import type { Experiment } from "@/features/experiment";
import { ref } from "vue";
import { i18n } from "@/services/i18n.service";
import { BRAINGLOBE_BASE_URL } from "@/features/atlas";

export const useRecentExperimentsStore = defineStore(
  "recent-experiments",
  () => {
    /**
     * Ordered list of recent experiments. Newest first.
     */
    const recents = ref<Experiment[]>([
      {
        id: crypto.randomUUID(),
        version: import.meta.env.APP_VERSION,
        name: i18n.global.t("currentExperiment.defaultName"),
        atlas: {
          source: BRAINGLOBE_BASE_URL,
          name: "allen_mouse"
        },
        referenceCoordinate: [5.7, 0.44, 5.4],
        visibleStructures: [],
        probeInterfaceProbes: {},
        probes: []
      },
      {
        id: crypto.randomUUID(),
        version: import.meta.env.APP_VERSION,
        name: i18n.global.t("currentExperiment.defaultName"),
        atlas: {
          source: BRAINGLOBE_BASE_URL,
          name: "allen_mouse"
        },
        referenceCoordinate: [5.7, 0.44, 5.4],
        visibleStructures: [],
        probeInterfaceProbes: {},
        probes: []
      }
    ]);

    /**
     * Add the most recent experiment.
     * @param experiment Experiment to add as the latest.
     */
    function add(experiment: Experiment) {
      recents.value.unshift(experiment);
    }

    /**
     * Take an experiment out of the recents. Returns it.
     * @param id Experiment ID to remove.
     */
    function remove(id: string): Experiment | null {
      const experimentIndex = recents.value.findIndex(
        recent => recent.id === id
      );
      if (!experimentIndex) return null;

      return recents.value.splice(experimentIndex, 1)[0] ?? null;
    }

    /**
     * Remove all recents.
     */
    function clear() {
      recents.value = [];
    }

    return { recents, add, open: remove, clear };
  },
  {
    persist: true
  }
);
