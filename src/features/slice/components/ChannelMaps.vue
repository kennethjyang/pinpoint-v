<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getProbeContour, getProbeShanks } from "@/features/probe";
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
    canvasHeight: "15vh"
  },
  medium: {
    header: "row q-gutter-x-sm no-wrap items-center",
    name: "text-body2",
    canvasHeight: "30vh"
  },
  large: {
    header: "row q-gutter-x-sm no-wrap",
    name: "text-body1",
    canvasHeight: "70vh"
  }
};

/** Horizontal exaggeration applied to every shank's width, so a skinny shank is legible. */
const SHANK_WIDTH_SCALE = 5;

const currentExperimentStore = useCurrentExperimentStore();
const { t } = useI18n();

const zoomSelection = ref<ChannelMapsZoom>("large");

const styles = computed(() => zoomStyles[zoomSelection.value]);

/** Each probe paired with its shanks, packed left to right at 5x their proportional width. */
const channelMaps = computed(() =>
  currentExperimentStore.probes.map(probe => {
    const definition =
      currentExperimentStore.probeInterfaceProbes[
        probe.probeInterfaceIdentifier
      ];
    const contour = definition ? getProbeContour(definition) : null;
    if (
      !definition ||
      !contour ||
      contour.widthMillimeters <= 0 ||
      contour.heightMillimeters <= 0
    ) {
      return {
        probe,
        shanks: [],
        heightMillimeters: 0,
        totalWidthMillimeters: 0,
        aspectRatio: 0
      };
    }

    const shanks = getProbeShanks(definition, contour);
    const totalWidthMillimeters = shanks.reduce(
      (total, shank) => total + shank.widthMillimeters,
      0
    );
    return {
      probe,
      shanks,
      heightMillimeters: contour.heightMillimeters,
      totalWidthMillimeters,
      aspectRatio:
        (SHANK_WIDTH_SCALE * totalWidthMillimeters) / contour.heightMillimeters
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
      <q-card
        v-for="{
          probe,
          shanks,
          heightMillimeters,
          totalWidthMillimeters,
          aspectRatio
        } of channelMaps"
        :key="probe.id"
      >
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
            v-if="shanks.length"
            class="channel-maps__viewport"
            :style="{ height: styles.canvasHeight, aspectRatio }"
          >
            <div class="row no-wrap fit">
              <div
                v-for="shank of shanks"
                :key="String(shank.id)"
                class="full-height channel-maps__shank"
                :style="{
                  flexGrow: shank.widthMillimeters / totalWidthMillimeters
                }"
              >
                <ChannelMapCanvas
                  :probe="probe"
                  :shank="shank"
                  :height-millimeters="heightMillimeters"
                />
              </div>
            </div>
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
    // must stretch for the shank row to fill the sized viewport. Scoped to
    // the direct child only - going deeper would also force width: 100% onto
    // each shank's flex cell, defeating flex-grow's proportional sizing.
    :deep(> div)
      width: 100%
      height: 100%

  &__shank
    flex-basis: 0
    min-width: 0

  &__no-contour
    width: 8rem
    text-align: center
</style>
