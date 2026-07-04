<script setup lang="ts">
import { ref } from "vue";

const leftDrawerOpen = ref(false);
const rightDrawerOpen = ref(false);
const tab = ref("scene");

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value;
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

        <q-toolbar-title> Pinpoint V</q-toolbar-title>

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

    <q-page-container> Hello World </q-page-container>
  </q-layout>
</template>
