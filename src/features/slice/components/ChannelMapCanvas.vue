<script lang="ts" setup>
import { computed, toRef, useTemplateRef } from "vue";
import { useDevicePixelRatio, useElementSize } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { Probe, ProbeShank } from "@/features/probe";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { getProbeFrame } from "../api/probe-frame.api";
import {
  getContactOutlinePath,
  getShankLayout,
  getShankOutlinePath,
  getShankSliceGeometry
} from "../api/slice-plane.api";
import { useAnnotationSampler } from "../composable/useAnnotationSampler";
import { useSliceCanvasPainter } from "../composable/useSliceCanvasPainter";

const { probe, shanks, heightMillimeters } = defineProps<{
  probe: Probe;
  shanks: ProbeShank[];
  /** Height of the probe's contour, spanned by every shank. */
  heightMillimeters: number;
}>();

const currentExperiment = useCurrentExperimentStore();
const { t } = useI18n();

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const { height } = useElementSize(canvas);
const { pixelRatio } = useDevicePixelRatio();

/** Packed layout of every shank into one canvas, or null while unmeasured. */
const layout = computed(() =>
  getShankLayout(shanks, heightMillimeters, height.value, pixelRatio.value)
);

/** Sampling surface covering every shank's band, or null while unmeasured. */
const plane = computed(() => {
  if (!layout.value) return null;
  const frame = getProbeFrame(probe, currentExperiment.referenceCoordinate);
  return getShankSliceGeometry(frame, layout.value, heightMillimeters);
});

const { createStream } = useAnnotationSampler({
  manifest: computed(() => currentExperiment.manifest),
  terminologyRows: computed(() => currentExperiment.terminologyRows)
});
const { result } = createStream(plane);

/** Height the sampled plane is centered on, matching `getShankSliceGeometry`. */
const centerHeightMillimeters = computed(() => heightMillimeters / 2);

/** viewBox spanning the packed shanks, centered like the sampled bands. */
const viewBox = computed(() =>
  layout.value
    ? `0 ${-centerHeightMillimeters.value} ${layout.value.widthMillimeters} ${heightMillimeters}`
    : null
);

/** Per-shank overlay geometry, in packed mm: a translate plus both paths. */
const overlays = computed(() =>
  (layout.value?.placements ?? []).map(placement => ({
    key: String(placement.shank.id),
    transform: `translate(${placement.offsetMillimeters} 0)`,
    outlinePath: getShankOutlinePath(
      placement.shank,
      centerHeightMillimeters.value
    ),
    contactsPath: getContactOutlinePath(
      placement.shank.contacts,
      centerHeightMillimeters.value
    )
  }))
);

/** Accessible label naming the probe. */
const ariaLabel = computed(() => t("slice.channelMap", { name: probe.name }));

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
      v-if="viewBox"
      class="fit absolute-top channel-map-canvas__overlay"
      :viewBox="viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        v-for="overlay of overlays"
        :key="overlay.key"
        :transform="overlay.transform"
      >
        <path :d="overlay.outlinePath" class="channel-map-canvas__contour" />
        <path
          v-if="overlay.contactsPath"
          :d="overlay.contactsPath"
          class="channel-map-canvas__contacts"
        />
      </g>
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
