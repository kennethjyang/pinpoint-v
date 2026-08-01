<script lang="ts" setup>
import { useDialogPluginComponent, useQuasar } from "quasar";
import { useRecentExperimentsStore } from "@/stores/recent-experiments.store";
import {
  Experiment,
  NewExperimentDialog,
  useExperimentFile
} from "@/features/experiment";
import { ref } from "vue";

const appVersion = import.meta.env.APP_VERSION;

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
const $q = useQuasar();
const recentExperimentsStore = useRecentExperimentsStore();
const { openExperiment, onOpened } = useExperimentFile();

const hoveredRecent = ref<number | null>(null);

/**
 * Prompt user to confirm before deletion.
 * @param experiment Experiment to delete.
 */
function onDeleteRecent(experiment: Experiment) {
  $q.dialog({
    title: "Delete Experiment",
    message: `Are you sure you wish to delete "${experiment.name}"?`,
    cancel: true,
    persistent: true,
    ok: {
      label: "Delete",
      color: "negative"
    }
  }).onOk(() => {
    recentExperimentsStore.remove(experiment);
  });
}

onOpened(onDialogOK);
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="splash">
      <q-card-section class="column full-width items-center">
        <p class="text-h2">Pinpoint V</p>
        <i class="text-caption">{{ appVersion }}</i>
      </q-card-section>

      <q-card-section>
        <div class="column q-gutter-y-md">
          <div class="row q-gutter-x-md justify-center">
            <q-btn
              icon="add"
              :label="$t('splash.new')"
              size="xl"
              @click="
                $q.dialog({ component: NewExperimentDialog }).onOk(onDialogOK)
              "
            />
            <q-btn
              v-close-popup
              color="primary"
              icon="play_arrow"
              :label="$t('splash.resume')"
              size="xl"
            />
            <q-btn
              icon="file_open"
              :label="$t('splash.open')"
              size="xl"
              @click="openExperiment"
            />
          </div>
          <div class="row q-gutter-x-md justify-center">
            <q-btn
              :label="$t('splash.userGuide')"
              href="/pinpoint-v/docs"
              icon="menu_book"
            />
            <q-btn
              :label="$t('splash.vblWebsite')"
              href="https://virtualbrainlab.org/index.html"
              icon="web"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-section>
        <q-virtual-scroll
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
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style lang="sass" scoped>
.splash
  min-width: 30vw
  max-height: 70vh
</style>
