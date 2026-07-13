import { computedAsync } from "@vueuse/core";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { AtlasMetadata, StructureModel } from "@/models/atlas.model";
import axios from "axios";
import { computed } from "vue";
import { Color3 } from "@babylonjs/core";

/**
 * Computed extraction of the current atlas based on the current experiment.
 */
export function useCurrentAtlas() {
  const currentExperimentStore = useCurrentExperimentStore();

  /**
   * Fetch the metadata for the current atlas.
   *
   * @returns The metadata or null if there was a problem fetching.
   */
  const metadata = computedAsync<AtlasMetadata | null>(async () => {
    if (!currentExperimentStore.atlas) return null;

    try {
      const metadataResponse = await axios.get<AtlasMetadata>(
        new URL(
          `${currentExperimentStore.atlas.name}/atlas.json`,
          currentExperimentStore.atlas.source
        ).toString()
      );

      return metadataResponse.data;
    } catch {
      return null;
    }
  });

  /**
   * Returns the resolved mesh path and color for the default structures, or an empty list if there was a problem.
   */
  const defaultStructuresModels = computed<StructureModel[]>(
    () =>
      metadata.value?.structures[metadata.value?.rootId]?.childrenIds.flatMap(
        id => structureModelFromId(id) ?? []
      ) ?? []
  );

  /**
   * Compute the structure model from a structure ID.
   * @param id ID of the structure to build the model for.
   * @returns The built structure model or null if there was a problem.
   */
  function structureModelFromId(id: number): StructureModel | null {
    // Get the structure.
    const structure = metadata.value?.structures[id];
    if (!structure) return null;

    // Extract color.
    const [r, g, b] = structure.color;

    // Build model.
    return {
      meshPath: new URL(
        `${currentExperimentStore.atlas.name}/meshes/${id}.glb`,
        currentExperimentStore.atlas.source
      ).toString(),
      color: Color3.FromInts(r, g, b)
    };
  }

  return { metadata, defaultStructuresModels };
}
