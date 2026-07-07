<script setup lang="ts">
/**
 * @file Build the base layout of the app.
 *
 * Handles sidebar functionality locally.
 */

import { ref } from "vue";
import { SceneCanvas } from "@/features/scene";
import { TouchPanValue, useQuasar } from "quasar";

const $q = useQuasar();

// Layout state.
const leftDrawerOpen = ref(false);
const rightDrawerOpen = ref(false);
const leftDrawerWidth = ref(350);
const rightDrawerWidth = ref(350);
const tab = ref("scene");
const splash = ref(true);
const appVersion = import.meta.env.APP_VERSION;

/**
 * Toggle left drawer open state.
 */
function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}

/**
 * Toggle right drawer open state.
 */
function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value;
}

/**
 * Change the size of the left drawer based on the touch pan directive.
 * @param details Touch pan directive values.
 */
const resizeLeftDrawer: TouchPanValue = function (details) {
  let delta = details.delta?.x ?? 0;

  // Clamp end value to be within 40% of the screen.
  if (leftDrawerWidth.value + delta >= window.innerWidth * 0.4) {
    delta = 0;
  }

  leftDrawerWidth.value += delta;
};

/**
 * Change the size of the right drawer based on the touch pan directive.
 * @param details Touch pan directive values.
 */
const resizeRightDrawer: TouchPanValue = function (details) {
  let delta = details.delta?.x ?? 0;

  // Clamp end value to be within 40% of the screen.
  if (rightDrawerWidth.value - delta >= window.innerWidth * 0.4) {
    delta = 0;
  }

  rightDrawerWidth.value -= delta;
};

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

        <q-btn flat label="View">
          <q-menu auto-close>
            <q-list>
              <q-item clickable>
                <q-item-section @click="$q.dark.toggle"
                  >Toggle Dark Mode
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-space />

        <q-btn dense flat round icon="menu" @click="toggleRightDrawer" />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      :width="leftDrawerWidth"
      bordered
      show-if-above
      side="left"
    >
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
      <div
        v-touch-pan.horizontal.prevent.mouse="resizeLeftDrawer"
        class="q-drawer__resizer q-drawer__resizer--left"
      ></div>
    </q-drawer>

    <q-drawer
      v-model="rightDrawerOpen"
      :width="rightDrawerWidth"
      bordered
      show-if-above
      side="right"
    >
      <!-- drawer content -->
      <div
        v-touch-pan.horizontal.prevent.mouse="resizeRightDrawer"
        class="q-drawer__resizer q-drawer__resizer--right"
      ></div>
    </q-drawer>

    <q-page-container>
      <q-page :style-fn="fixedQPageHeight">
        <SceneCanvas />
      </q-page>
    </q-page-container>
  </q-layout>

  <q-dialog v-model="splash">
    <q-card class="splash">
      <q-card-section class="column full-width items-center">
        <p class="text-h2">Pinpoint V</p>
        <i class="text-caption">{{ appVersion }}</i>
      </q-card-section>

      <q-card-section>
        <div class="row q-gutter-x-md justify-center">
          <q-btn icon="play_circle" label="Resume" size="xl" />
          <q-btn icon="add_circle" label="New" size="xl" />
          <q-btn icon="file_open" label="Open" size="xl" />
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
  </q-dialog>
</template>

<style lang="sass" scoped>
.q-drawer__resizer
  position: absolute
  top: 0
  bottom: 0
  width: 3px
  background-color: $grey-5
  cursor: ew-resize

  &:after
    content: ''
    position: absolute
    top: 50%
    height: 10%
    left: -2px
    right: -2px
    transform: translateY(-50%)
    background-color: inherit
    border-radius: 4px

body.body--dark .q-drawer__resizer
  background-color: $grey-8

.q-drawer__resizer--left
  right: -1.5px

.q-drawer__resizer--right
  left: -1.5px

.splash
  width: 50vw

.splash__recents
  max-height: 50vh
</style>
