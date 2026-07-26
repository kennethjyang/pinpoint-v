import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { Experiment } from "@/features/experiment";
import {
  Atlas,
  AtlasMetadata,
  BRAINGLOBE_BASE_URL,
  fetchAtlasMetadata,
  getDefaultStructureIdentifiers,
  getManifest,
  getTerminologyRows,
  Manifest
} from "@/features/atlas";

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
      atlas: {
        source: BRAINGLOBE_BASE_URL,
        name: "allen_mouse"
      },
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
     * Fetch the metadata for the current experiment's atlas.
     * @deprecated
     */
    const metadata = computedAsync<AtlasMetadata | null>(async () =>
      fetchAtlasMetadata(atlas.value)
    );

    const manifest = computedAsync<Manifest | null>(
      async () => await getManifest(atlas.value)
    );

    /**
     * Fetch the terminology rows which provide the regions of the atlas.
     */
    const terminologyRows = computedAsync(
      async () => await getTerminologyRows(atlas.value),
      []
    );

    /**
     * Default (top-level) structure identifiers for the current experiment's
     * atlas.
     */
    const defaultStructureIdentifiers = computed<number[]>(() =>
      terminologyRows.value
        ? getDefaultStructureIdentifiers(terminologyRows.value)
        : []
    );

    /**
     * Set the reference coordinate of the experiment.
     * @param referenceCoordinate Reference coordinate (in ASR, mm) that the
     * atlas root should be offset by.
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
        if (index !== -1) {
          visibleStructures.value.splice(index, 1);
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
      metadata,
      manifest,
      terminologyRows,
      defaultStructureIdentifiers,
      setReferenceCoordinate,
      referenceCoordinate,
      isStructureVisible,
      setStructureVisibility,
      clearVisibleStructures
    };
  },
  { persist: true }
);
