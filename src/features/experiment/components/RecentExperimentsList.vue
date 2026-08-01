<script lang="ts" setup>
import { useQuasar } from "quasar";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { Experiment } from "../models/experiment.model";
import { useRecentExperimentsStore } from "@/stores/recent-experiments.store";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

const emit = defineEmits<{ opened: [] }>();

const $q = useQuasar();
const { t } = useI18n();
const currentExperimentStore = useCurrentExperimentStore();
const recentExperimentsStore = useRecentExperimentsStore();

const hoveredRecent = ref<number | null>(null);

/**
 * Open a recent experiment.
 * @param experiment
 */
function onOpenRecent(experiment: Experiment) {
  recentExperimentsStore.remove(experiment);
  currentExperimentStore.loadExperiment(experiment);
  emit("opened");
}

/**
 * Prompt user to confirm before deletion.
 * @param experiment Experiment to delete.
 */
function onDeleteRecent(experiment: Experiment) {
  $q.dialog({
    title: t("recentExperiments.deleteExperiment"),
    message: t("recentExperiments.confirmDelete", { name: experiment.name }),
    cancel: true,
    persistent: true,
    ok: {
      label: t("recentExperiments.delete"),
      color: "negative"
    }
  }).onOk(() => {
    recentExperimentsStore.remove(experiment);
  });
}
</script>

<template>
  <q-virtual-scroll
    v-if="recentExperimentsStore.recents.length"
    v-slot="{ item, index }"
    :items="recentExperimentsStore.recents"
    separator
    class="dialog-list"
  >
    <q-item
      :key="index"
      v-ripple
      clickable
      @mouseenter="hoveredRecent = index"
      @mouseleave="hoveredRecent = null"
      @click="onOpenRecent(item)"
    >
      <q-item-section> {{ item.name }} </q-item-section>
      <q-item-section side>
        <q-btn
          v-if="index === hoveredRecent"
          dense
          flat
          icon="delete"
          round
          @click.stop="onDeleteRecent(item)"
        />
      </q-item-section>
    </q-item>
  </q-virtual-scroll>
  <q-item v-else>
    <q-item-section class="text-caption text-center">
      {{ $t("recentExperiments.noRecents") }}
    </q-item-section>
  </q-item>
</template>
