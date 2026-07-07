<script lang="ts" setup>
/**
 * @file Interface to create a new experiment.
 */

import { ref } from "vue";

const name = ref<string | null>(null);
</script>

<template>
  <q-card>
    <q-card-section>
      <p class="text-h5">New Experiment</p>
      <q-form>
        <q-input v-model="name" clearable label="Name" />
      </q-form>
    </q-card-section>
    <q-card-actions align="right">
      <q-btn color="primary" label="Create" />
    </q-card-actions>
  </q-card>
</template>

<style lang="sass" scoped></style>
