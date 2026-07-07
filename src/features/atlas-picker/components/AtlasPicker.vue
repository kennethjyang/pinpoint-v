<script lang="ts" setup>
/**
 * @file Atlas picker interface.
 */

import { ref } from "vue";

const atlasSource = ref<string | null>(
  "https://virtualbrainlab.alleninstitute.org/pinpoint/atlases"
);
const atlas = ref<string | null>(null);

let atlases = ref(["One", "Two", "Three", "Four", "Five"]);
let favorites = ref(["Six", "Seven", "Eight"]);

function swapSelectedAtlas() {
  if (!atlas.value) return;
  const selectedAtlas = atlas.value;

  // Index in each.
  const atlasesIndex = atlases.value.indexOf(selectedAtlas);
  const favoritesIndex = favorites.value.indexOf(selectedAtlas);

  // Swap.
  if (atlasesIndex !== -1) {
    atlases.value.splice(atlasesIndex, 1);
    favorites.value.push(selectedAtlas);
  } else {
    favorites.value.splice(favoritesIndex, 1);
    atlases.value.push(selectedAtlas);
  }
}
</script>

<template>
  <q-form class="q-gutter-y-sm">
    <p class="text-h6">Atlas Source</p>

    <div class="row q-gutter-x-md">
      <q-btn color="primary" icon="public" label="Pinpoint Atlases" />
      <q-btn icon="home" label="Locally Hosted" />
    </div>

    <q-input v-model="atlasSource" class="col" clearable label="Source URL" />

    <q-btn color="primary" label="Connect" />

    <div class="row items-center q-gutter-x-md">
      <div class="column col">
        <p class="text-subtitle1">Atlases</p>
        <q-scroll-area class="atlas-list">
          <q-list separator>
            <q-item
              v-for="atlasName in atlases"
              v-ripple
              :active="atlasName === atlas"
              clickable
              @click="atlas = atlasName"
            >
              <q-item-section>
                {{ atlasName }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </div>

      <q-btn color="primary" icon="swap_horiz" @click="swapSelectedAtlas" />

      <div class="column col">
        <p class="text-subtitle1">Favorites</p>
        <q-scroll-area class="atlas-list">
          <q-list separator>
            <q-item
              v-for="atlasName in favorites"
              v-ripple
              :active="atlasName === atlas"
              clickable
              @click="atlas = atlasName"
            >
              <q-item-section>
                {{ atlasName }}
              </q-item-section>
            </q-item>
          </q-list>
        </q-scroll-area>
      </div>
    </div>
  </q-form>
</template>

<style lang="sass" scoped>
.atlas-list
  height: 30vh
</style>
