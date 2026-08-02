<script lang="ts" setup>
import { computed, ref, toRef, useTemplateRef } from "vue";
import {
  useDevicePixelRatio,
  useElementSize,
  useElementVisibility
} from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { TerminologyRow } from "@/features/atlas";
import type { Probe } from "@/features/probe";
import { getProbeContacts, getProbeContour } from "@/features/probe";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { useDelayedFlag } from "@/composable/useDelayedFlag";
import {
  getChannelMapPlane,
  getChannelMapRegionBands,
  getChannelMapSamplePixels,
  getContactOverlayShapes,
  selectVisibleBandLabels
} from "../api/channel-map.api";
import { getProbeFrame } from "../api/probe-frame.api";
import {
  getContourPolygonPoints,
  getSlicePixelFromRect
} from "../api/slice-plane.api";
import { buildStructureIndex } from "../api/structure-colors.api";
import { useAnnotationSampler } from "../composable/useAnnotationSampler";
import { useChannelMapRange } from "../composable/useChannelMapRange";
import { useSliceCanvasPainter } from "../composable/useSliceCanvasPainter";

/** How long sampling must run before the loading bar is worth showing. */
const LOADING_BAR_DELAY_MILLISECONDS = 500;

/** Height reserved per abbreviation label, in pixels. */
const LABEL_HEIGHT_PIXELS = 20;

const { probe } = defineProps<{ probe: Probe }>();

const currentExperiment = useCurrentExperimentStore();
const { t } = useI18n();

const root = useTemplateRef<HTMLDivElement>("root");
const canvasArea = useTemplateRef<HTMLDivElement>("canvasArea");
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const { width: canvasAreaWidth, height: canvasAreaHeight } =
  useElementSize(canvasArea);
const { pixelRatio } = useDevicePixelRatio();
const isVisible = useElementVisibility(root);

/** Annotation value currently under the pointer, or 0 for background/none. */
const hoveredAnnotationValue = ref(0);

const probeInterfaceProbe = computed(
  () =>
    currentExperiment.probeInterfaceProbes[probe.probeInterfaceIdentifier] ??
    null
);

const contour = computed(() =>
  probeInterfaceProbe.value ? getProbeContour(probeInterfaceProbe.value) : null
);

const contacts = computed(() =>
  probeInterfaceProbe.value ? getProbeContacts(probeInterfaceProbe.value) : null
);

const { range } = useChannelMapRange(
  toRef(() => probe),
  contour
);

/** Height up the contour the currently sampled rectangle is centered on. */
const centerHeightMillimeters = computed(
  () => (range.value.startMillimeters + range.value.endMillimeters) / 2
);

const frame = computed(() =>
  getProbeFrame(probe, currentExperiment.referenceCoordinate)
);

/**
 * The channel map's rectangle at a placeholder 1x1 pixel size, for its
 * half-extents (the SVG overlay's viewBox) - independent of canvas layout,
 * so the overlay renders before the canvas has ever been sized.
 */
const overlayGeometry = computed(() =>
  contour.value
    ? getChannelMapPlane(frame.value, contour.value, range.value, 1, 1)
    : null
);

const samplePixels = computed(() =>
  getChannelMapSamplePixels(
    canvasAreaWidth.value,
    canvasAreaHeight.value,
    pixelRatio.value
  )
);

/** Sampling geometry, null while offscreen, unlaid-out, or without a contour. */
const geometry = computed(() => {
  if (!isVisible.value || !overlayGeometry.value) return null;
  const { widthPixels, heightPixels } = samplePixels.value;
  if (widthPixels === 0 || heightPixels === 0) return null;
  return { ...overlayGeometry.value, widthPixels, heightPixels };
});

const { createStream } = useAnnotationSampler({
  manifest: computed(() => currentExperiment.manifest),
  terminologyRows: computed(() => currentExperiment.terminologyRows)
});
const { result, isLoading } = createStream(geometry);

/**
 * Whether to show the loading bar. Sampling is usually fast enough that
 * binding the bar straight to `isLoading` strobes it - a range drag replans
 * every frame - so it only appears once loading has run past
 * `LOADING_BAR_DELAY_MILLISECONDS`, and hides the moment loading ends.
 */
const isLoadingBarVisible = useDelayedFlag(
  isLoading,
  LOADING_BAR_DELAY_MILLISECONDS
);

/** SVG polygon points for the contour overlay, in probe-local mm re-origined on the visible center. */
const contourPoints = computed(() =>
  contour.value
    ? getContourPolygonPoints(contour.value, centerHeightMillimeters.value)
    : null
);

/** In-range contact footprints, in the same overlay mm space as the contour. */
const contactShapes = computed(() =>
  contacts.value
    ? getContactOverlayShapes(
        contacts.value,
        range.value,
        centerHeightMillimeters.value
      )
    : []
);

const structureIndex = computed(() =>
  buildStructureIndex(currentExperiment.terminologyRows)
);

const regionBands = computed(() =>
  result.value
    ? getChannelMapRegionBands(result.value, structureIndex.value, range.value)
    : []
);

const visibleBandLabels = computed(() =>
  selectVisibleBandLabels(
    regionBands.value,
    range.value,
    canvasAreaHeight.value,
    LABEL_HEIGHT_PIXELS
  )
);

const hoveredStructure = computed<TerminologyRow | null>(() =>
  hoveredAnnotationValue.value
    ? (structureIndex.value.get(hoveredAnnotationValue.value) ?? null)
    : null
);

/** Range slider's two-thumb model, adapted from the persisted depth range. */
const rangeModel = computed({
  get: () => ({
    min: range.value.startMillimeters,
    max: range.value.endMillimeters
  }),
  set: value => {
    range.value = { startMillimeters: value.min, endMillimeters: value.max };
  }
});

/**
 * Update the hovered structure from a pointer move over the canvas.
 * @param event Pointer move event.
 */
function onPointerMove(event: PointerEvent): void {
  const element = canvas.value;
  const slice = result.value;
  if (!element || !slice) {
    hoveredAnnotationValue.value = 0;
    return;
  }

  const pixel = getSlicePixelFromRect(
    element.getBoundingClientRect(),
    event.clientX,
    event.clientY,
    slice.widthPixels,
    slice.heightPixels
  );
  hoveredAnnotationValue.value = pixel
    ? (slice.annotationValues[pixel.y * slice.widthPixels + pixel.x] ?? 0)
    : 0;
}

function onPointerLeave(): void {
  hoveredAnnotationValue.value = 0;
}

useSliceCanvasPainter(
  canvas,
  result,
  toRef(() => probe.id)
);
</script>

<template>
  <div ref="root" class="column large-channel-map">
    <div class="row items-center q-gutter-x-sm large-channel-map__header">
      <q-icon name="radio_button_checked" :style="{ color: probe.color }" />
      <div class="large-channel-map__name">{{ probe.name }}</div>
    </div>

    <div class="col row no-wrap items-stretch large-channel-map__body">
      <q-range
        v-if="contour"
        v-model="rangeModel"
        vertical
        reverse
        :min="0"
        :max="contour.heightMillimeters"
        :left-label-value="`${range.startMillimeters.toFixed(2)} mm`"
        :right-label-value="`${range.endMillimeters.toFixed(2)} mm`"
        label
        :step="0"
        dense
        class="col-auto large-channel-map__range"
        :aria-label="t('channelMaps.range')"
      />

      <div
        ref="canvasArea"
        class="relative-position large-channel-map__canvas-area"
      >
        <canvas
          ref="canvas"
          class="fit large-channel-map__canvas"
          @pointermove="onPointerMove"
          @pointerleave="onPointerLeave"
        />
        <svg
          v-if="overlayGeometry"
          class="fit absolute-top large-channel-map__overlay"
          :viewBox="`${-overlayGeometry.halfWidthMillimeters} ${-overlayGeometry.halfHeightMillimeters} ${2 * overlayGeometry.halfWidthMillimeters} ${2 * overlayGeometry.halfHeightMillimeters}`"
          preserveAspectRatio="none"
        >
          <polygon
            v-if="contourPoints"
            :points="contourPoints"
            class="large-channel-map__contour"
          />
          <template v-for="(shape, index) in contactShapes" :key="index">
            <circle
              v-if="shape.kind === 'circle'"
              :cx="shape.centerX"
              :cy="shape.centerY"
              :r="shape.widthMillimeters / 2"
              class="large-channel-map__contact"
            />
            <rect
              v-else
              :x="shape.centerX - shape.widthMillimeters / 2"
              :y="shape.centerY - shape.heightMillimeters / 2"
              :width="shape.widthMillimeters"
              :height="shape.heightMillimeters"
              :transform="
                shape.rotationDegrees
                  ? `rotate(${shape.rotationDegrees} ${shape.centerX} ${shape.centerY})`
                  : undefined
              "
              class="large-channel-map__contact"
            />
          </template>
        </svg>

        <q-linear-progress
          v-if="isLoadingBarVisible"
          indeterminate
          color="primary"
          size="sm"
          class="absolute-top"
        />

        <div v-if="!contour" class="fit flex flex-center absolute-top">
          <p class="text-caption text-weight-light">{{
            t("slice.noContour")
          }}</p>
        </div>

        <q-tooltip v-if="hoveredStructure" model-value no-parent-event>
          {{ hoveredStructure.abbreviation }} - {{ hoveredStructure.name }}
        </q-tooltip>
      </div>

      <div class="relative-position large-channel-map__labels">
        <div
          v-for="band in visibleBandLabels"
          :key="`${band.annotationValue}-${band.startMillimeters}`"
          class="absolute large-channel-map__label"
          :style="{
            top: `${band.topPixels}px`,
            height: `${LABEL_HEIGHT_PIXELS}px`
          }"
        >
          {{ band.abbreviation }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="sass" scoped>
.large-channel-map
  height: 80vh
  width: max-content

  &__header
    flex: none

  &__name
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  &__range
    margin-right: 8px

  &__canvas-area
    flex: none
    width: 120px
    border: 1px solid $separator-color
    border-radius: $generic-border-radius
    overflow: hidden

  &__canvas
    display: block

  &__overlay
    pointer-events: none

  &__contour
    fill: none
    stroke: $dark
    stroke-width: 0.02
    opacity: 0.6

  &__contact
    fill: none
    stroke: $dark
    stroke-width: 1
    vector-effect: non-scaling-stroke
    opacity: 0.6

  &__labels
    flex: none
    width: 160px
    margin-left: 8px

  &__label
    left: 0
    right: 0
    display: flex
    align-items: center
    font-size: 0.75rem
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

body.body--dark
  .large-channel-map__canvas-area
    border-color: $separator-dark-color

  .large-channel-map__contour,
  .large-channel-map__contact
    stroke: #fff
</style>
