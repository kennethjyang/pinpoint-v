import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { Experiment } from "@/features/experiment";
import {
  Atlas,
  BRAINGLOBE_BASE_URL,
  getAtlasCenter,
  getDefaultStructureIdentifiers,
  getManifest,
  getTerminologyRows,
  Manifest
} from "@/features/atlas";
import { Probe } from "@/features/probe";
import { Entity } from "@/features/scene";

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
      probes: []
    });

    const selectedEntity = ref<Entity | null>(null);

    /**
     * Create a new experiment with the given name, atlas, and reference
     * coordinate.
     * @param name Experiment name.
     * @param atlas Full atlas object.
     * @param referenceCoordinate Reference coordinate (in ASR, mm) marking
     * the experiment's landmark of interest within the atlas.
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
        visibleStructures: [],
        probes: []
      };
    }

    /**
     * Set the name of the experiment.
     * @param name Experiment name.
     */
    function setName(name: string) {
      experiment.value.name = name;
    }

    /**
     * Get the current experiment name.
     */
    const name = computed(() => experiment.value.name);

    /**
     * Get the current experiment atlas.
     */
    const atlas = computed(() => experiment.value.atlas);

    /**
     * Flag for when the manifest is being updated to match the new atlas.
     */
    const isManifestEvaluating = ref(false);

    /**
     * Manifest of the current atlas.
     */
    const manifest = computedAsync<Manifest | null>(
      async () => await getManifest(atlas.value),
      null,
      isManifestEvaluating
    );

    /**
     * Flag for when the terminology rows are being updated to match the new atlas.
     */
    const isTerminologyRowsEvaluating = ref(false);

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
     * Are the getters into the current atlas still evaluating.
     */
    const areAtlasComponentsEvaluating = computed(
      () => isManifestEvaluating.value || isTerminologyRowsEvaluating.value
    );

    /**
     * Default (top-level) structure identifiers for the current experiment's
     * atlas.
     */
    const defaultStructureIdentifiers = computed<number[]>(() =>
      terminologyRows.value && !areAtlasComponentsEvaluating.value
        ? getDefaultStructureIdentifiers(terminologyRows.value)
        : []
    );

    /**
     * Current experiment's atlas center.
     */
    const atlasCenter = computed<[number, number, number]>(() =>
      manifest.value && !isManifestEvaluating.value
        ? getAtlasCenter(manifest.value)
        : [0, 0, 0]
    );

    /**
     * Set the reference coordinate of the experiment.
     * @param referenceCoordinate Reference coordinate (in ASR, mm) marking
     * the experiment's landmark of interest within the atlas.
     */
    function setReferenceCoordinate(
      referenceCoordinate: [number, number, number]
    ) {
      experiment.value.referenceCoordinate = referenceCoordinate;
    }

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
      selectedEntity.value = probe;
    }

    /**
     * Remove probe from experiment.
     *
     * Do nothing if the probe is not in the experiment. Deselects it as well.
     * @param probe Probe to remove.
     */
    function removeProbe(probe: Probe) {
      const probeIndex = experiment.value.probes.findIndex(
        experimentProbe => experimentProbe.name === probe.name
      );
      if (probeIndex === -1) return;
      experiment.value.probes.splice(probeIndex, 1);

      // Deselects it.
      if (isEntitySelected(probe)) {
        selectedEntity.value = null;
      }
    }

    /**
     * Helper to determine if the passed entity is the actively selected one.
     * @param entity
     */
    function isEntitySelected(entity: Entity): boolean {
      if (!selectedEntity.value) return false;

      if (selectedEntity.value.kind !== entity.kind) return false;

      switch (selectedEntity.value.kind) {
        case "probe":
          return selectedEntity.value.name === entity.name;
        default:
          return false;
      }
    }

    return {
      experiment,
      selectedEntity,
      visibleStructures,
      create,
      setName,
      name,
      atlas,
      manifest,
      terminologyRows,
      areAtlasComponentsEvaluating,
      defaultStructureIdentifiers,
      atlasCenter,
      setReferenceCoordinate,
      referenceCoordinate,
      isStructureVisible,
      setStructureVisibility,
      clearVisibleStructures,
      probes,
      addProbe,
      removeProbe,
      isEntitySelected
    };
  },
  {
    persist: { pick: ["experiment"] }
  }
);
