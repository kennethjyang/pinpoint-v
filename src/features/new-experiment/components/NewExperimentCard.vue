<script lang="ts" setup>
/**
 * @file Interface to create a new experiment.
 */

import { ref } from "vue";
import { AtlasPicker } from "@/features/atlas-picker";

const name = ref<string | null>(null);
</script>

<template>
  <q-card class="new-experiment">
    <q-card-section>
      <p class="text-h5">New Experiment</p>
      <q-input v-model="name" clearable label="Name" />
      <AtlasPicker />
    </q-card-section>
    <q-card-actions align="right">
      <q-btn color="primary" label="Create" />
    </q-card-actions>
  </q-card>
</template>

<style lang="sass" scoped>
.new-experiment
  width: 50vw
  max-height: 70vh
</style>
