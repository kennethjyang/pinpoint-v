<script lang="ts" setup>
/**
 * @file Atlas picker interface.
 */
import { ref } from "vue";

const atlasSource = ref<string | null>(
  "https://virtualbrainlab.alleninstitute.org/pinpoint/atlases"
);
const atlas = ref<string | null>(null);
</script>

<template>
  <q-form>
    <p class="text-h6">Atlas Source</p>

    <q-btn label="Pinpoint Atlases" />
    <q-btn label="Locally Hosted" />
    <q-input v-model="atlasSource" clearable label="Source URL" />

    <q-scroll-area class="lists col">
      <q-list bordered separator>
        <q-item v-ripple active clickable>
          <q-item-section>Picked</q-item-section>
        </q-item>
        <q-item v-for="n in 20" v-ripple clickable>
          <q-item-section>Atlas {{ n }}</q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>
  </q-form>
</template>

<style lang="sass" scoped>
.lists
  height: 30vh
</style>
