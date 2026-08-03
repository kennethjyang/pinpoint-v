<script lang="ts" setup>
import { ref } from "vue";
import LargeChannelMap from "./LargeChannelMap.vue";
import MediumChannelMap from "./MediumChannelMap.vue";
import SmallChannelMap from "./SmallChannelMap.vue";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

type ChannelMapsZoom = "small" | "medium" | "large";

const currentExperimentStore = useCurrentExperimentStore();

const zoomSelection = ref<ChannelMapsZoom>("large");
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
    <div
      v-for="probe of currentExperimentStore.experiment.probes"
      v-if="zoomSelection === 'large'"
      class="row"
    >
      <LargeChannelMap :probe="probe" />
    </div>
    <div
      v-for="probe of currentExperimentStore.experiment.probes"
      v-else-if="zoomSelection === 'medium'"
      class="row"
    >
      <MediumChannelMap :probe="probe" />
    </div>
    <div
      v-for="probe of currentExperimentStore.experiment.probes"
      v-else-if="zoomSelection === 'small'"
      class="row"
    >
      <SmallChannelMap :probe="probe" />
    </div>
  </div>
</template>

<style lang="sass" scoped></style>
