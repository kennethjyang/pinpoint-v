import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { Experiment } from "@/features/experiment";
import {
  BRAINGLOBE_BASE_URL,
  getManifest,
  getTerminologyRows,
  Manifest
} from "@/features/atlas";
import { detachProbeInterfaceProbe } from "@/features/probe";
import { Inspectable } from "@/features/scene";

export const useCurrentExperimentStore = defineStore(
  "current-experiment",
  () => {
    /**
     * Current experiment instance.
     */
    const experiment = ref<Experiment>({
      name: "My First Experiment",
      atlas: {
        source: BRAINGLOBE_BASE_URL,
        name: "allen_mouse"
      },
      referenceCoordinate: [5.7, 0.44, 5.4],
      visibleStructures: [],
      probeInterfaceProbes: {},
      probes: []
    });

    const selectedInspectable = ref<Inspectable | null>(null);

    /**
     * Flag for when the manifest is being updated to match the new atlas.
     */
    const isManifestEvaluating = ref(false);

    /**
     * Flag for when the terminology rows are being updated to match the new atlas.
     */
    const isTerminologyRowsEvaluating = ref(false);

    /**
     * Are the getters into the current atlas still evaluating.
     */
    const areAtlasComponentsEvaluating = computed(
      () => isManifestEvaluating.value || isTerminologyRowsEvaluating.value
    );

    /**
     * Get the current experiment name.
     */
    const name = computed(() => experiment.value.name);

    /**
     * Get the current experiment atlas.
     */
    const atlas = computed(() => experiment.value.atlas);

    /**
     * Manifest of the current atlas.
     */
    const manifest = computedAsync<Manifest | null>(
      async () => await getManifest(atlas.value),
      null,
      isManifestEvaluating
    );

    /**
     * Terminology rows of the current atlas.
     */
    const terminologyRows = computedAsync(
      async () =>
        manifest.value ? await getTerminologyRows(manifest.value) : [],
      [],
      isTerminologyRowsEvaluating
    );

    /**
     * Get the current experiment's reference coordinate.
     */
    const referenceCoordinate = computed(
      () => experiment.value.referenceCoordinate
    );

    /**
     * List of structure identifiers actively being shown in the atlas.
     */
    const visibleStructures = computed({
      get: () => experiment.value.visibleStructures,
      set: (value: number[]) => {
        experiment.value.visibleStructures = value;
      }
    });

    /**
     * Probe interface definitions used by this experiment's probes, keyed by
     * probe identifier.
     */
    const probeInterfaceProbes = computed(
      () => experiment.value.probeInterfaceProbes
    );

    const probes = computed(() => experiment.value.probes);

    /**
     * Helper to determine if the passed entity is the actively selected one.
     * @param entity
     */
    function isInspectableSelected(entity: Inspectable): boolean {
      if (!selectedInspectable.value) return false;

      if (selectedInspectable.value.inspectableKind !== entity.inspectableKind)
        return false;

      switch (selectedInspectable.value.inspectableKind) {
        case "probe":
          return selectedInspectable.value.name === entity.name;
        default:
          return false;
      }
    }

    return {
      experiment,
      selectedInspectable,
      isManifestEvaluating,
      visibleStructures,
      name,
      atlas,
      manifest,
      terminologyRows,
      areAtlasComponentsEvaluating,
      referenceCoordinate,
      probes,
      probeInterfaceProbes,
      isInspectableSelected
    };
  },
  {
    persist: {
      pick: ["experiment"],

      // Re-mark probe interface definitions as raw to prevent tracking.
      afterHydrate: context => {
        const experiment: Experiment = context.store.experiment;
        for (const [identifier, definition] of Object.entries(
          experiment.probeInterfaceProbes
        )) {
          experiment.probeInterfaceProbes[identifier] =
            detachProbeInterfaceProbe(definition);
        }
      }
    }
  }
);
