<script lang="ts" setup>
/**
 * @file Create Babylon scene canvas and initialize runtime.
 */

import { onMounted, onUnmounted, useTemplateRef } from "vue";
import { useBabylonRuntime } from "@/composable/useBabylonRuntime";

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
</script>

<template>
  <canvas ref="canvas" height="500" width="500" />
</template>

<style scoped></style>
