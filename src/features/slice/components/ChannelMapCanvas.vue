<script lang="ts" setup>
import { computed, toRef, useTemplateRef } from "vue";
import { useDevicePixelRatio, useElementSize } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { Probe, ProbeShank } from "@/features/probe";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { getProbeFrame } from "../api/probe-frame.api";
import {
  getContactOutlinePath,
  getShankOutlinePath,
  getShankSlicePlane,
  getSliceSizePixels
} from "../api/slice-plane.api";
import { useAnnotationSampler } from "../composable/useAnnotationSampler";
import { useSliceCanvasPainter } from "../composable/useSliceCanvasPainter";

const { probe, shank, heightMillimeters } = defineProps<{
  probe: Probe;
  shank: ProbeShank;
  /** Height of the probe's contour, shared by every shank canvas so they align. */
  heightMillimeters: number;
}>();

const currentExperiment = useCurrentExperimentStore();
const { t } = useI18n();

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const { height } = useElementSize(canvas);
const { pixelRatio } = useDevicePixelRatio();

/** Device-pixel dimensions of the canvas, quantized and shank-proportioned. */
const sizePixels = computed(() =>
  getSliceSizePixels(
    shank.widthMillimeters,
    heightMillimeters,
    height.value,
    pixelRatio.value
  )
);

/** Sampling rectangle covering the shank's full extent, or null while unmeasured. */
const plane = computed(() => {
  const { widthPixels, heightPixels } = sizePixels.value;
  if (heightPixels === 0) return null;
  const frame = getProbeFrame(probe, currentExperiment.referenceCoordinate);
  return getShankSlicePlane(
    frame,
    shank,
    heightMillimeters,
    widthPixels,
    heightPixels
  );
});

const { createStream } = useAnnotationSampler({
  manifest: computed(() => currentExperiment.manifest),
  terminologyRows: computed(() => currentExperiment.terminologyRows)
});
const { result } = createStream(plane);

/** Height the sampled plane is centered on, matching `getShankSlicePlane`. */
const centerHeightMillimeters = computed(() => heightMillimeters / 2);

/** viewBox spanning the shank's full extent, centered like the sampled plane. */
const viewBox = computed(
  () =>
    `${shank.minimumXMillimeters} ${-centerHeightMillimeters.value} ${shank.widthMillimeters} ${heightMillimeters}`
);

/** Shank outline as one SVG path, one closed subpath per ring. */
const outlinePath = computed(() =>
  getShankOutlinePath(shank, centerHeightMillimeters.value)
);

/** Contact outlines as one SVG path, empty when the shank has none. */
const contactsPath = computed(() =>
  getContactOutlinePath(shank.contacts, centerHeightMillimeters.value)
);

/** Accessible label, naming the shank when the probe has more than one. */
const ariaLabel = computed(() =>
  shank.id === null
    ? t("slice.channelMap", { name: probe.name })
    : t("slice.channelMapShank", { name: probe.name, shank: String(shank.id) })
);

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
      :aria-label="ariaLabel"
    />
    <svg
      class="fit absolute-top channel-map-canvas__overlay"
      :viewBox="viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path :d="outlinePath" class="channel-map-canvas__contour" />
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
