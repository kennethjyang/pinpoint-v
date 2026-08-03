<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getProbeContour } from "@/features/probe";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import ChannelMapCanvas from "./ChannelMapCanvas.vue";

type ChannelMapsZoom = "small" | "medium" | "large";

interface ZoomStyles {
  /** Layout classes for the card header. */
  header: string;
  /** Typography class for the probe name. */
  name: string;
  /** CSS height of the slice canvas at this zoom. */
  canvasHeight: string;
}

const zoomStyles: Record<ChannelMapsZoom, ZoomStyles> = {
  small: {
    header: "column flex-center",
    name: "text-caption",
    canvasHeight: "20vh"
  },
  medium: {
    header: "row q-gutter-x-sm no-wrap items-center",
    name: "text-body2",
    canvasHeight: "50vh"
  },
  large: {
    header: "row q-gutter-x-sm no-wrap",
    name: "text-body1",
    canvasHeight: "80vh"
  }
};

const currentExperimentStore = useCurrentExperimentStore();
const { t } = useI18n();

const zoomSelection = ref<ChannelMapsZoom>("large");

const styles = computed(() => zoomStyles[zoomSelection.value]);

/** Each probe paired with its contour, or null when it has none to slice. */
const channelMaps = computed(() =>
  currentExperimentStore.probes.map(probe => {
    const definition =
      currentExperimentStore.probeInterfaceProbes[
        probe.probeInterfaceIdentifier
      ];
    const contour = definition ? getProbeContour(definition) : null;
    return {
      probe,
      contour:
        contour && contour.widthMillimeters > 0 && contour.heightMillimeters > 0
          ? contour
          : null
    };
  })
);
</script>

<template>
  <div class="column full-height no-wrap q-gutter-y-sm">
    <q-btn-toggle
      v-model="zoomSelection"
      :options="[
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' }
      ]"
      spread
      toggle-color="primary"
      class="col-auto"
    />
    <div class="col row q-gutter-sm content-start channel-maps__scroll">
      <q-card v-for="{ probe, contour } of channelMaps" :key="probe.id">
        <q-card-section :class="styles.header">
          <q-icon
            :style="{ color: probe.color }"
            name="radio_button_checked"
            size="sm"
          />
          <div :class="styles.name">{{ probe.name }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section class="flex flex-center q-pa-sm">
          <q-intersection
            v-if="contour"
            class="channel-maps__viewport"
            :style="{
              height: styles.canvasHeight,
              aspectRatio: contour.widthMillimeters / contour.heightMillimeters
            }"
          >
            <ChannelMapCanvas :probe="probe" :contour="contour" />
          </q-intersection>
          <div
            v-else
            class="flex flex-center text-caption text-weight-light channel-maps__no-contour"
            :style="{ height: styles.canvasHeight }"
          >
            {{ t("slice.noContour") }}
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style lang="sass" scoped>
.channel-maps
  &__scroll
    overflow-y: auto

  &__viewport
    min-width: 1px

    // QIntersection renders its slot inside a plain div of its own, which
    // must stretch for the canvas to fill the sized viewport.
    :deep(div)
      width: 100%
      height: 100%

  &__no-contour
    width: 8rem
    text-align: center
</style>
