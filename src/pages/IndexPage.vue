<script setup lang="ts">
/**
 * @file Build the base layout of the app.
 *
 * Handles sidebar functionality locally.
 */

import { ref } from "vue";
import { SceneCanvas } from "@/features/scene";

const leftDrawerOpen = ref(false);
const rightDrawerOpen = ref(false);
const tab = ref("scene");
const appVersion = import.meta.env.APP_VERSION;

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value;
}

/**
 * Force minHeight and height of QPage to be the same.
 * @param offset Height offset caused by the header and footer.
 */
function fixedQPageHeight(offset: number) {
  const height = offset ? `calc(100vh - ${offset}px)` : "100vh";

  return {
    minHeight: height,
    height
  };
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title shrink> Pinpoint V</q-toolbar-title>

        <i class="text-weight-light q-pr-sm">{{ appVersion }}</i>

        <q-btn flat label="File">
          <q-menu auto-close>
            <q-list>
              <q-item clickable>
                <q-item-section>Save</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-btn flat label="Edit">
          <q-menu auto-close>
            <q-list>
              <q-item clickable>
                <q-item-section>Preferences</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-space />

        <q-btn dense flat round icon="menu" @click="toggleRightDrawer" />
      </q-toolbar>
    </q-header>

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
      <q-tabs v-model="tab">
        <q-tab name="scene" label="Scene" />
        <q-tab name="channel-maps" label="Channel Maps" />
        <q-tab name="atlas" label="Atlas" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="tab" animated>
        <q-tab-panel name="scene"> Scene </q-tab-panel>
        <q-tab-panel name="channel-maps"> Channel maps </q-tab-panel>
        <q-tab-panel name="atlas"> Atlas </q-tab-panel>
      </q-tab-panels>
    </q-drawer>

    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered>
      <!-- drawer content -->
    </q-drawer>

    <q-page-container>
      <q-page :style-fn="fixedQPageHeight">
        <SceneCanvas />
      </q-page>
    </q-page-container>
  </q-layout>
</template>
