<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import LargeChannelMap from "./LargeChannelMap.vue";

type ChannelMapsZoom = "small" | "medium" | "large";

const currentExperiment = useCurrentExperimentStore();
const { t } = useI18n();

const zoomSelection = ref<ChannelMapsZoom>("large");
</script>

<template>
  <div class="column">
    <q-btn-toggle
      v-model="zoomSelection"
      :options="[
        { label: t('channelMaps.small'), value: 'small' },
        { label: t('channelMaps.medium'), value: 'medium' },
        { label: t('channelMaps.large'), value: 'large' }
      ]"
      spread
      toggle-color="primary"
    />

    <p
      v-if="currentExperiment.probes.length === 0"
      class="text-caption text-weight-light q-mt-md"
    >
      {{ t("channelMaps.noProbes") }}
    </p>

    <q-scroll-area class="col channel-maps__scroll-area">
      <div class="row items-start q-gutter-md channel-maps__panels">
        <LargeChannelMap
          v-for="probe in currentExperiment.probes"
          :key="probe.id"
          :probe="probe"
        />
      </div>
    </q-scroll-area>
  </div>
</template>

<style lang="sass" scoped>
.channel-maps__scroll-area
  height: 80vh

.channel-maps__panels
  flex-wrap: wrap
</style>
