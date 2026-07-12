<script lang="ts" setup>
import { watch } from "vue";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { useAtlasService } from "@/composable/useAtlasService";

const currentExperimentStore = useCurrentExperimentStore();
const atlasService = useAtlasService();

// Set the atlas service to the current experiment's atlas.
watch(
  currentExperimentStore.atlas,
  async atlas => {
    if (!atlas) return;
    await atlasService.setAtlas(atlas);
  },
  { immediate: true }
);
</script>

<template>
  <router-view />
</template>
