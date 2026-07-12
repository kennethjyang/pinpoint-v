import { computedAsync } from "@vueuse/core";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { AtlasMetadata } from "@/models/atlas-metadata.model";
import axios from "axios";
import { computed } from "vue";

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
   * Returns the resolved paths for the default structures or an empty list if there was a problem.
   */
  const defaultStructuresMeshPaths = computed<string[]>(
    () =>
      metadata.value?.structures[metadata.value?.rootId]?.childrenIds.map(id =>
        new URL(
          `${currentExperimentStore.atlas.name}/meshes/${id}.glb`,
          currentExperimentStore.atlas.source
        ).toString()
      ) ?? []
  );

  return { metadata, defaultStructuresMeshPaths };
}
