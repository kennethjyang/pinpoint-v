<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, watch } from "vue";
import { useBabylonRuntime } from "@/composable/useBabylonRuntime";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { loadDefaultStructures } from "@/features/scene";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const runtime = useBabylonRuntime();
const currentExperimentStore = useCurrentExperimentStore();

onMounted(async () => {
  // Exit if no canvas.
  if (!canvas.value) {
    throw new Error("Scene canvas not found in DOM!");
  }

  // Initialize Babylon runtime.
  await runtime.init(canvas.value);

  // Load current experiment.
  watch(
    runtime.scene,
    async () => {
      if (!runtime.scene.value) return;
      await loadDefaultStructures(
        currentExperimentStore.atlas,
        runtime.scene.value
      );
    },
    { immediate: true }
  );
});

onUnmounted(() => {
  runtime.dispose();
});

/**
 * Trigger engine resizing on page area resize.
 */
function onResize() {
  runtime.engine.value?.resize();
}
</script>

<template>
  <canvas ref="canvas" class="fit" />
  <q-resize-observer @resize="onResize" />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
