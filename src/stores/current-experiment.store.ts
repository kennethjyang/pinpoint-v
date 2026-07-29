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
import {
  detachProbeInterfaceProbe,
  getProbeIdentifier,
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
     * Is the structure visible on the atlas in the experiment.
     * @param identifier Identifier of the structure to check.
     */
    function isStructureVisible(identifier: number) {
      return visibleStructures.value.includes(identifier);
    }

    /**
     * Set the visibility of the structure in the atlas.
     * @param identifier Identifier of the structure to set the visibility of.
     * @param value Is the structure visible or not.
     */
    function setStructureVisibility(identifier: number, value: boolean) {
      if (value) {
        if (!isStructureVisible(identifier)) {
          visibleStructures.value.push(identifier);
        }
      } else {
        const index = visibleStructures.value.indexOf(identifier);
        if (index === -1) return;
        visibleStructures.value.splice(index, 1);
      }
    }

    /**
     * Reset visible structures.
     */
    function clearVisibleStructures() {
      experiment.value.visibleStructures = [];
    }

    const probes = computed<Probe[]>(() => experiment.value.probes);

    /**
     * Probe interface definitions used by this experiment's probes, keyed by
     * probe identifier.
     */
    const probeInterfaceProbes = computed(
      () => experiment.value.probeInterfaceProbes
    );

    /**
     * Intern a probe interface definition into the experiment and return its
     * identifier, keeping the existing definition if one is already interned
     * under that identifier.
     * @param probeInterfaceProbe Probe interface definition to intern, e.g.
     * from the probe library.
     */
    function internProbeInterfaceProbe(
      probeInterfaceProbe: ProbeInterfaceProbe
    ): string {
      const identifier = getProbeIdentifier(probeInterfaceProbe);
      if (!experiment.value.probeInterfaceProbes[identifier]) {
        experiment.value.probeInterfaceProbes[identifier] =
          detachProbeInterfaceProbe(probeInterfaceProbe);
      }
      return identifier;
    }

    /**
     * Resolve a probe's interface definition, or null if it isn't interned.
     * @param probe Probe to resolve the definition of.
     */
    function probeInterfaceProbeFor(probe: Probe): ProbeInterfaceProbe | null {
      return (
        experiment.value.probeInterfaceProbes[probe.probeIdentifier] ?? null
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
          experimentProbe.probeIdentifier === removed!.probeIdentifier
      );
      if (!stillReferenced) {
        delete experiment.value.probeInterfaceProbes[removed!.probeIdentifier];
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
      isStructureVisible,
      setStructureVisibility,
      clearVisibleStructures,
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
