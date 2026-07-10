<script lang="ts" setup>
/**
 * @file Interface to create a new experiment.
 */

import { ref } from "vue";
import { AtlasPicker } from "@/features/atlas-picker";

const name = ref<string | null>(null);
const atlas = ref<string | null>(null);
</script>

<template>
  <q-card class="new-experiment">
    <q-card-section class="q-gutter-y-md">
      <p class="text-h5">{{ $t("newExperiment.title") }}</p>

      <q-input
        v-model="name"
        clearable
        :label="$t('newExperiment.experimentName')"
      />

      <AtlasPicker v-model="atlas" />
    </q-card-section>
    <q-card-actions align="right">
      <q-btn color="positive" icon="add" :label="$t('newExperiment.create')" />
    </q-card-actions>
  </q-card>
</template>

<style lang="sass" scoped>
.new-experiment
  min-width: 25vw
  width: fit-content
</style>
