<script lang="ts" setup>
import { computed } from "vue";
import { Probe } from "@/features/probe";
import { STANDARD_COLORS } from "@/features/scene";

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
  <div class="column q-gutter-y-md">
    <q-input v-model="probe.name" clearable label="Name" outlined />

    <div>
      <p class="text-h6">Tip Position</p>
      <div class="row q-gutter-x-sm">
        <q-input v-model.number="ap" class="col" dense label="AP" outlined />
        <q-input v-model.number="dv" class="col" dense label="DV" outlined />
        <q-input v-model.number="ml" class="col" dense label="ML" outlined />
      </div>
    </div>

    <div>
      <p class="text-h6">Orientation</p>
      <div class="row q-gutter-x-sm">
        <q-input
          v-model.number="roll"
          class="col"
          dense
          label="Roll"
          outlined
        />
        <q-input v-model.number="yaw" class="col" dense label="Yaw" outlined />
        <q-input
          v-model.number="pitch"
          class="col"
          dense
          label="Pitch"
          outlined
        />
      </div>
    </div>

    <div>
      <p class="text-h6">Color</p>
      <q-color
        v-model="probe.color"
        :palette="STANDARD_COLORS"
        default-view="palette"
      />
    </div>
  </div>
</template>

<style lang="sass" scoped></style>
