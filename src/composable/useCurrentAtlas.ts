import { computedAsync } from "@vueuse/core";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { AtlasMetadata, StructureEntity } from "@/models/atlas.model";
import { fetchAtlasMetadata } from "@/features/atlas-picker";
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

    return fetchAtlasMetadata(currentExperimentStore.atlas);
  });

  const defaultStructureIds = computed<number[]>(
    () => metadata.value?.structures[metadata.value?.rootId]?.childrenIds ?? []
  );

  /**
   * Compute the structure model from a structure ID.
   * @param id ID of the structure to build the model for.
   * @returns The built structure model or null if there was a problem.
   */
  function structureEntityFromId(id: number): StructureEntity | null {
    // Get the structure.
    const structure = metadata.value?.structures[id];
    if (!structure) return null;

    // Extract color.
    const [r, g, b] = structure.color;

    // Build model.
    return {
      name: id.toString(),
      meshPath: new URL(
        `${currentExperimentStore.atlas.name}/meshes/${id}.glb`,
        currentExperimentStore.atlas.source
      ).toString(),
      color: Color3.FromInts(r, g, b)
    };
  }

  return {
    metadata,
    defaultStructureIds,
    structureEntityFromId
  };
}
