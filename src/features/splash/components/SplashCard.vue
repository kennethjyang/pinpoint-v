<script lang="ts" setup>
const appVersion = import.meta.env.APP_VERSION;
</script>

<template>
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
</template>

<style lang="sass" scoped>
.splash
  width: 50vw

.splash__recents
  max-height: 50vh
</style>
