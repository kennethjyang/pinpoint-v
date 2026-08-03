<script lang="ts" setup>
import { computed, ref } from "vue";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

type ChannelMapsZoom = "small" | "medium" | "large";

interface ZoomClasses {
  header: string;
  name: string;
}

const zoomClasses: Record<ChannelMapsZoom, ZoomClasses> = {
  small: { header: "column flex-center", name: "text-caption" },
  medium: {
    header: "row q-gutter-x-sm no-wrap items-center",
    name: "text-body2"
  },
  large: { header: "row q-gutter-x-sm no-wrap", name: "text-body1" }
};

const currentExperimentStore = useCurrentExperimentStore();

const zoomSelection = ref<ChannelMapsZoom>("large");

const classes = computed(() => zoomClasses[zoomSelection.value]);
</script>

<template>
  <div class="column q-gutter-y-sm">
    <q-btn-toggle
      v-model="zoomSelection"
      :options="[
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' }
      ]"
      spread
      toggle-color="primary"
    />
    <div class="row q-gutter-sm">
      <q-card v-for="probe of currentExperimentStore.experiment.probes">
        <q-card-section :class="classes.header">
          <q-icon
            :style="{ color: probe.color }"
            name="radio_button_checked"
            size="sm"
          />
          <div :class="classes.name">{{ probe.name }}</div>
        </q-card-section>
        <q-separator />
        <q-card-section> Channel maps </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style lang="sass" scoped></style>
