<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef } from "vue";
import { useBabylonRuntime } from "@/composable/useBabylonRuntime";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const runtime = useBabylonRuntime();

onMounted(async () => {
  // Exit if no canvas.
  if (!canvas.value) {
    throw new Error("Scene canvas not found in DOM!");
  }

  // Initialize Babylon runtime.
  await runtime.init(canvas.value);
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
