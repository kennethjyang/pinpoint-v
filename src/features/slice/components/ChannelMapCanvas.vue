<script lang="ts" setup>
import { computed, toRef, useTemplateRef } from "vue";
import { useDevicePixelRatio, useElementSize } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { Probe, ProbeContour } from "@/features/probe";
import { getProbeContactOutlines } from "@/features/probe";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { getProbeFrame } from "../api/probe-frame.api";
import {
  getContactOutlinePath,
  getContourPolygonPoints,
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

/** Height the sampled plane is centered on, matching `getContourSlicePlane`. */
const centerHeightMillimeters = computed(() => contour.heightMillimeters / 2);

/** viewBox spanning the contour's full extent, centered like the sampled plane. */
const viewBox = computed(
  () =>
    `${-contour.widthMillimeters / 2} ${-centerHeightMillimeters.value} ${contour.widthMillimeters} ${contour.heightMillimeters}`
);

const contourPoints = computed(() =>
  getContourPolygonPoints(contour, centerHeightMillimeters.value)
);

/** Contact outlines as one SVG path, empty when the definition has none. */
const contactsPath = computed(() => {
  const definition =
    currentExperiment.probeInterfaceProbes[probe.probeInterfaceIdentifier];
  if (!definition) return "";
  return getContactOutlinePath(
    getProbeContactOutlines(definition, contour.origin),
    centerHeightMillimeters.value
  );
});

useSliceCanvasPainter(
  canvas,
  result,
  toRef(() => probe.id)
);
</script>

<template>
  <div class="fit relative-position channel-map-canvas">
    <canvas
      ref="canvas"
      class="fit channel-map-canvas__canvas"
      role="img"
      :aria-label="t('slice.channelMap', { name: probe.name })"
    />
    <svg
      class="fit absolute-top channel-map-canvas__overlay"
      :viewBox="viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon :points="contourPoints" class="channel-map-canvas__contour" />
      <path
        v-if="contactsPath"
        :d="contactsPath"
        class="channel-map-canvas__contacts"
      />
    </svg>
  </div>
</template>

<style lang="sass" scoped>
.channel-map-canvas
  &__canvas
    display: block

  &__overlay
    pointer-events: none

  &__contour
    fill: none
    stroke: $dark
    stroke-opacity: 0.6
    stroke-width: 1
    vector-effect: non-scaling-stroke

  &__contacts
    fill: none
    stroke: $dark
    stroke-opacity: 0.6
    stroke-width: 1
    vector-effect: non-scaling-stroke

body.body--dark
  .channel-map-canvas__contour
    stroke: #fff

  .channel-map-canvas__contacts
    stroke: #fff
</style>
