<script lang="ts" setup>
import { Probe } from "@/features/probe";

const { probe } = defineProps<{
  probe: Probe;
}>();
</script>

<template>
  <q-card>
    <q-card-section class="row q-gutter-x-sm no-wrap items-center">
      <q-icon
        :style="{ color: probe.color }"
        name="radio_button_checked"
        size="sm"
      />
      <div class="text-body2">{{ probe.name }}</div>
    </q-card-section>
    <q-separator />
    <q-card-section> Channel maps </q-card-section>
  </q-card>
</template>

<style lang="sass" scoped></style>
