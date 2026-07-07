<script lang="ts" setup>
/**
 * @file Splash screen interface.
 *
 * Includes launching the new experiment interface.
 */

import { ref } from "vue";
import { NewExperimentCard } from "@/features/new-experiment";

const showNewExperiment = ref(true);
const appVersion = import.meta.env.APP_VERSION;
</script>

<template>
  <q-card class="splash">
    <q-card-section class="column full-width items-center">
      <p class="text-h2">Pinpoint V</p>
      <i class="text-caption">{{ appVersion }}</i>
    </q-card-section>

    <q-card-section>
      <div class="column q-gutter-y-md">
        <div class="row q-gutter-md justify-center">
          <q-btn
            icon="add"
            label="New"
            size="xl"
            @click="showNewExperiment = true"
          />
          <q-btn
            v-close-popup
            color="primary"
            icon="play_arrow"
            label="Resume"
            size="xl"
          />
          <q-btn icon="file_open" label="Open" size="xl" />
        </div>
        <div class="row q-gutter-md justify-center">
          <q-btn icon="menu_book" label="User Guide" />
          <q-btn icon="web" label="VBL Website" />
        </div>
      </div>
    </q-card-section>

    <q-card-section class="splash__recents scroll">
      <q-list separator>
        <q-item v-for="n in 20" v-ripple clickable>
          <q-item-section>Some Recent Experiment {{ n }}</q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>

  <q-dialog v-model="showNewExperiment">
    <NewExperimentCard />
  </q-dialog>
</template>

<style lang="sass" scoped>
.splash
  width: 50vw

.splash__recents
  max-height: 30vh
</style>
