<script lang="ts" setup>
/**
 * @file Create Babylon scene canvas and initialize runtime.
 */

import { onMounted, onUnmounted, useTemplateRef } from "vue";
import { useBabylonRuntime } from "@/composable/useBabylonRuntime";
import { vResizeObserver } from "@vueuse/components";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const runtime = useBabylonRuntime();

onMounted(() => {
  // Exit if no canvas.
  if (!canvas.value) {
    throw new Error("Scene canvas not found in DOM!");
  }

  // Initialize Babylon runtime.
  runtime.init(canvas.value);
});

onUnmounted(() => {
  runtime.dispose();
});

/**
 * Handle canvas wrapper resizing by resizing the canvas and triggering an engine resize.
 * @param entries Resized items from observer (first one is the wrapper).
 */
function onResize(entries: ResizeObserverEntry[]) {
  // Extract the wrapper element.
  const [entry] = entries;

  // Exit if no info.
  if (!entry || !canvas.value) return;

  // Extract info.
  const { width, height } = entry.contentRect;
  const dpr = window.devicePixelRatio || 1;

  // Resize canvas.
  canvas.value.width = Math.round(width * dpr);
  canvas.value.height = Math.round(height * dpr);

  console.log(`${canvas.value.width} x ${canvas.value.height}`);

  // Trigger Babylon resize.
  // runtime.engine.value?.resize();
}
</script>

<template>
  <div v-resize-observer="onResize" class="fill">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
div {
  width: 100%;
  height: 100%;
  min-height: inherit;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
