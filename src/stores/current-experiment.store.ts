import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";
import { computedAsync } from "@vueuse/core";
import { Experiment } from "@/features/experiment";
import {
  BRAINGLOBE_BASE_URL,
  getManifest,
  getTerminologyRows,
  Manifest
} from "@/features/atlas";
import {
  detachProbeInterfaceProbe,
  Probe,
  ProbeInterfaceProbe
} from "@/features/probe";
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
      probeInterfaceProbes: [],
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

    const probes = computed<Probe[]>(() => experiment.value.probes);

    /**
     * Probe interface definitions used by this experiment's probes.
     */
    const probeInterfaceProbes = computed(
      () => experiment.value.probeInterfaceProbes
    );

    /**
     * Intern a probe interface definition into the experiment, deduping
     * against definitions already present, and return its id.
     *
     * The returned definition is detached from Vue's reactivity (see
     * `detachProbeInterfaceProbe`) so that the (possibly large) definition
     * doesn't get deep-traversed on every store mutation.
     * @param probeInterfaceProbe Probe interface definition to intern, e.g.
     * from the probe library.
     */
    function internProbeInterfaceProbe(
      probeInterfaceProbe: ProbeInterfaceProbe
    ): string {
      const key = JSON.stringify(toRaw(probeInterfaceProbe));
      const existing = experiment.value.probeInterfaceProbes.find(
        entry => JSON.stringify(entry.probeInterfaceProbe) === key
      );
      if (existing) return existing.id;

      const id = crypto.randomUUID();
      experiment.value.probeInterfaceProbes.push({
        id,
        probeInterfaceProbe: detachProbeInterfaceProbe(probeInterfaceProbe)
      });
      return id;
    }

    /**
     * Resolve a probe's interface definition.
     *
     * Returns null if the probe's definition isn't in the experiment, e.g.
     * an experiment persisted before `probeInterfaceProbes` was introduced.
     * @param probe Probe to resolve the definition of.
     */
    function probeInterfaceProbeFor(probe: Probe): ProbeInterfaceProbe | null {
      return (
        experiment.value.probeInterfaceProbes.find(
          entry => entry.id === probe.probeInterfaceProbeId
        )?.probeInterfaceProbe ?? null
      );
    }

    /**
     * Add a probe to the experiment and select it.
     *
     * Do nothing if a probe with the same name already exists.
     * @param probe Probe to add.
     */
    function addProbe(probe: Probe) {
      if (
        experiment.value.probes.find(
          existingProbe => existingProbe.name === probe.name
        )
      )
        return;

      experiment.value.probes.push(probe);
      selectedInspectable.value = probe;
    }

    /**
     * Remove probe from experiment.
     *
     * Do nothing if the probe is not in the experiment. Deselects it as
     * well, and drops its interface definition if no other probe still
     * references it.
     * @param probe Probe to remove.
     */
    function removeProbe(probe: Probe) {
      const probeIndex = experiment.value.probes.findIndex(
        experimentProbe => experimentProbe.name === probe.name
      );
      if (probeIndex === -1) return;
      const [removed] = experiment.value.probes.splice(probeIndex, 1);

      const stillReferenced = experiment.value.probes.some(
        experimentProbe =>
          experimentProbe.probeInterfaceProbeId ===
          removed!.probeInterfaceProbeId
      );
      if (!stillReferenced) {
        const definitionIndex = experiment.value.probeInterfaceProbes.findIndex(
          entry => entry.id === removed!.probeInterfaceProbeId
        );
        if (definitionIndex !== -1)
          experiment.value.probeInterfaceProbes.splice(definitionIndex, 1);
      }

      // Deselects it.
      if (isInspectableSelected(probe)) {
        selectedInspectable.value = null;
      }
    }

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
      internProbeInterfaceProbe,
      probeInterfaceProbeFor,
      addProbe,
      removeProbe,
      isInspectableSelected
    };
  },
  {
    persist: {
      pick: ["experiment"],

      // Re-mark probe instance definitions as raw to prevent tracking.
      afterHydrate: context => {
        for (const entry of context.store.experiment.probeInterfaceProbes) {
          entry.probeInterfaceProbe = detachProbeInterfaceProbe(
            entry.probeInterfaceProbe
          );
        }
      }
    }
  }
);
