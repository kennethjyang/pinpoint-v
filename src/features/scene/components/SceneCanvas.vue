<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, watch } from "vue";
import { useBabylonRuntimeService } from "@/composable/useBabylonRuntimeService";
import { loadStructures } from "@/features/scene";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const runtime = useBabylonRuntimeService();
const currentAtlas = useCurrentAtlas();

onMounted(async () => {
  // Exit if no canvas.
  if (!canvas.value) {
    throw new Error("Scene canvas not found in DOM!");
  }

  // Initialize Babylon runtime.
  await runtime.init(canvas.value);

  // Load current experiment.
  watch(
    [runtime.scene, currentAtlas.defaultStructuresMeshPaths],
    async ([scene, defaultStructuresMeshPaths]) => {
      if (!scene || !defaultStructuresMeshPaths) return;
      await loadStructures(defaultStructuresMeshPaths, scene);
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
