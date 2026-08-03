<script lang="ts" setup>
import { computed, toRef, useTemplateRef } from "vue";
import { useDevicePixelRatio, useElementSize } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { Probe, ProbeContour } from "@/features/probe";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { getProbeFrame } from "../api/probe-frame.api";
import {
  getContourSizePixels,
  getContourSlicePlane
} from "../api/slice-plane.api";
import { useAnnotationSampler } from "../composable/useAnnotationSampler";
import { useSliceCanvasPainter } from "../composable/useSliceCanvasPainter";

const { probe, contour } = defineProps<{
  probe: Probe;
  contour: ProbeContour;
}>();

const currentExperiment = useCurrentExperimentStore();
const { t } = useI18n();

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const { height } = useElementSize(canvas);
const { pixelRatio } = useDevicePixelRatio();

/** Device-pixel dimensions of the canvas, quantized and contour-proportioned. */
const sizePixels = computed(() =>
  getContourSizePixels(contour, height.value, pixelRatio.value)
);

/** Sampling rectangle covering the contour's full extent, or null while unmeasured. */
const plane = computed(() => {
  const { widthPixels, heightPixels } = sizePixels.value;
  if (heightPixels === 0) return null;
  const frame = getProbeFrame(probe, currentExperiment.referenceCoordinate);
  return getContourSlicePlane(frame, contour, widthPixels, heightPixels);
});

const { createStream } = useAnnotationSampler({
  manifest: computed(() => currentExperiment.manifest),
  terminologyRows: computed(() => currentExperiment.terminologyRows)
});
const { result } = createStream(plane);

useSliceCanvasPainter(
  canvas,
  result,
  toRef(() => probe.id)
);
</script>

<template>
  <canvas
    ref="canvas"
    class="fit channel-map-canvas"
    role="img"
    :aria-label="t('slice.channelMap', { name: probe.name })"
  />
</template>

<style lang="sass" scoped>
.channel-map-canvas
  display: block
</style>
