<script lang="ts" setup>
import { computed } from "vue";
import { Probe } from "@/features/probe";

const { probe } = defineProps<{
  probe: Probe;
}>();

const ap = computed({
  get: () => probe.tipPosition[0],
  set: (value: number) => (probe.tipPosition[0] = value)
});

const dv = computed({
  get: () => probe.tipPosition[1],
  set: (value: number) => (probe.tipPosition[1] = value)
});

const ml = computed({
  get: () => probe.tipPosition[2],
  set: (value: number) => (probe.tipPosition[2] = value)
});

const roll = computed({
  get: () => probe.orientation[0],
  set: (value: number) => (probe.orientation[0] = value)
});

const yaw = computed({
  get: () => probe.orientation[1],
  set: (value: number) => (probe.orientation[1] = value)
});

const pitch = computed({
  get: () => probe.orientation[2],
  set: (value: number) => (probe.orientation[2] = value)
});
</script>

<template>
  <div class="column">
    <p class="text-h6">Tip Position</p>
    <div class="row">
      <q-input label="AP" v-model="ap" />
      <q-input label="DV" v-model="dv" />
      <q-input label="ML" v-model="ml" />
    </div>

    <p class="text-h6">Orientation</p>
    <div class="row">
      <q-input label="Roll" v-model="roll" />
      <q-input label="Yaw" v-model="yaw" />
      <q-input label="Pitch" v-model="pitch" />
    </div>
  </div>
</template>

<style lang="sass" scoped></style>
