<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch } from "vue";
import { useDevicePixelRatio, useElementSize } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { TerminologyRow } from "@/features/atlas";
import type { Probe } from "@/features/probe";
import { getProbeContacts, getProbeContour } from "@/features/probe";
import {
  isStructureVisible,
  setStructureVisibility
} from "@/features/experiment";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { getProbeFrame } from "../api/probe-frame.api";
import { findStructureByAnnotationValue } from "../api/structure-colors.api";
import {
  SLICE_EXTENTS_MILLIMETERS,
  getDefaultSliceExtentIndex,
  getProbeSlicePlane
} from "../api/slice-plane.api";
import { useAnnotationSampler } from "../composable/useAnnotationSampler";

/** Device-pixel edge lengths the canvas is quantized to, to bound replan frequency. */
const MINIMUM_SIZE_PIXELS = 128;
const MAXIMUM_SIZE_PIXELS = 512;
const SIZE_QUANTUM_PIXELS = 32;

const { probe } = defineProps<{ probe: Probe }>();

const currentExperiment = useCurrentExperimentStore();
const { t } = useI18n();

const container = useTemplateRef<HTMLDivElement>("container");
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const { width } = useElementSize(container);
const { pixelRatio } = useDevicePixelRatio();

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

/** Zoom ladder index: the store's explicit choice, or an auto-framed default. */
const extentIndex = computed(() => {
  const stored = currentExperiment.sliceExtentIndex;
  return stored ?? getDefaultSliceExtentIndex(contacts.value);
});

const extentMillimeters = computed(
  () => SLICE_EXTENTS_MILLIMETERS[extentIndex.value]!
);

/** Device-pixel edge length of the square canvas, quantized to bound replans. */
const sizePixels = computed(() => {
  const devicePixels = width.value * pixelRatio.value;
  const quantized =
    Math.floor(devicePixels / SIZE_QUANTUM_PIXELS) * SIZE_QUANTUM_PIXELS;
  return Math.min(
    MAXIMUM_SIZE_PIXELS,
    Math.max(MINIMUM_SIZE_PIXELS, quantized)
  );
});

const plane = computed(() => {
  if (!contacts.value) return null;
  const frame = getProbeFrame(probe, currentExperiment.referenceCoordinate);
  return getProbeSlicePlane(
    frame,
    contacts.value,
    extentMillimeters.value,
    sizePixels.value
  );
});

const { createStream } = useAnnotationSampler({
  manifest: computed(() => currentExperiment.manifest),
  terminologyRows: computed(() => currentExperiment.terminologyRows)
});
const { result, isLoading } = createStream(plane);

/** SVG polygon points for the contour overlay, in probe-local mm re-origined on the plane center. */
const contourPoints = computed(() => {
  if (!contour.value || !contacts.value) return null;
  const { x: centerX, y: centerY } = contacts.value.centerMillimeters;
  return contour.value.points
    .map(({ x, y }) => `${x - centerX},${centerY - y}`)
    .join(" ");
});

const hoveredStructure = computed<TerminologyRow | null>(() => {
  if (!hoveredAnnotationValue.value) return null;
  return findStructureByAnnotationValue(
    currentExperiment.terminologyRows,
    hoveredAnnotationValue.value
  );
});

/**
 * Convert a pointer event to a device-pixel coordinate on the slice canvas.
 * @param event Pointer event over the canvas.
 */
function pixelFromEvent(event: PointerEvent): { x: number; y: number } | null {
  const element = canvas.value;
  const slice = result.value;
  if (!element || !slice) return null;

  const size = Math.round(Math.sqrt(slice.sampleCount));
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const x = Math.floor(((event.clientX - rect.left) / rect.width) * size);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * size);
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  return { x, y };
}

/**
 * Update the hovered structure from a pointer move over the canvas.
 * @param event Pointer move event.
 */
function onPointerMove(event: PointerEvent): void {
  const pixel = pixelFromEvent(event);
  const slice = result.value;
  if (!pixel || !slice) {
    hoveredAnnotationValue.value = 0;
    return;
  }

  const size = Math.round(Math.sqrt(slice.sampleCount));
  hoveredAnnotationValue.value =
    slice.annotationValues[pixel.y * size + pixel.x] ?? 0;
}

function onPointerLeave(): void {
  hoveredAnnotationValue.value = 0;
}

/**
 * Toggle the hovered structure's visibility in the 3D scene.
 */
function onClick(): void {
  const structure = hoveredStructure.value;
  if (!structure) return;

  setStructureVisibility(
    currentExperiment.experiment,
    structure.identifier,
    !isStructureVisible(currentExperiment.experiment, structure.identifier)
  );
}

/**
 * Move one step along the zoom ladder, clamped to its ends.
 * @param delta +1 to zoom out (larger extent), -1 to zoom in.
 */
function zoomBy(delta: number): void {
  const next = extentIndex.value + delta;
  if (next < 0 || next >= SLICE_EXTENTS_MILLIMETERS.length) return;
  currentExperiment.sliceExtentIndex = next;
}

// The canvas's width/height attributes (device pixels) must match the
// result's size for putImageData to be valid; happy-dom's getContext("2d")
// returns null, so this is also what makes the component mountable in specs.
watch([result, sizePixels], () => {
  const element = canvas.value;
  const slice = result.value;
  if (!element || !slice?.pixels) return;

  const size = Math.round(Math.sqrt(slice.sampleCount));
  if (element.width !== size) {
    element.width = size;
    element.height = size;
  }

  const context = element.getContext("2d");
  if (!context) return;
  // `SampleResult.pixels` is declared as a plain `Uint8ClampedArray`, which
  // TS's newer typed-array generics widen to `ArrayBufferLike` (a superset
  // that also covers SharedArrayBuffer); `ImageData` only accepts the
  // narrower `ArrayBuffer`-backed variant, so this is a type-only mismatch.
  const pixels = slice.pixels as Uint8ClampedArray<ArrayBuffer>;
  context.putImageData(new ImageData(pixels, size, size), 0, 0);
});
</script>

<template>
  <div ref="container" class="slice-canvas relative-position">
    <div class="slice-canvas__square">
      <canvas
        ref="canvas"
        class="fit"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
        @click="onClick"
      />
      <svg
        v-if="plane"
        class="fit absolute-top slice-canvas__overlay"
        :viewBox="`${-plane.halfExtentMillimeters} ${-plane.halfExtentMillimeters} ${extentMillimeters} ${extentMillimeters}`"
        preserveAspectRatio="none"
      >
        <polygon
          v-if="contourPoints"
          :points="contourPoints"
          class="slice-canvas__contour"
        />
      </svg>

      <q-linear-progress
        v-if="isLoading"
        indeterminate
        color="secondary"
        size="sm"
        class="absolute-top"
      />

      <div v-if="!contacts" class="fit flex flex-center absolute-top">
        <p class="text-caption text-weight-light">{{
          t("slice.noContacts")
        }}</p>
      </div>

      <q-tooltip v-if="hoveredStructure">
        {{ hoveredStructure.abbreviation }} - {{ hoveredStructure.name }}
      </q-tooltip>
    </div>

    <div class="row items-center justify-center q-gutter-x-sm q-mt-xs">
      <q-btn-group flat>
        <q-btn
          dense
          icon="remove"
          :disable="extentIndex === 0"
          :aria-label="t('slice.zoomIn')"
          @click="zoomBy(-1)"
        />
        <q-btn
          dense
          icon="add"
          :disable="extentIndex === SLICE_EXTENTS_MILLIMETERS.length - 1"
          :aria-label="t('slice.zoomOut')"
          @click="zoomBy(1)"
        />
      </q-btn-group>
      <span class="text-caption">{{
        t("slice.extent", { extent: extentMillimeters })
      }}</span>
    </div>
  </div>
</template>

<style lang="sass" scoped>
.slice-canvas
  width: 100%

  &__square
    position: relative
    width: 100%
    aspect-ratio: 1
    background-color: $dark

  &__overlay
    pointer-events: none

  &__contour
    fill: none
    stroke: white
    stroke-width: 0.02
    opacity: 0.6
</style>
