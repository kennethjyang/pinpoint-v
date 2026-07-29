<script lang="ts" setup>
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import ProbeInspector from "../components/ProbeInspector.vue";

const currentExperiment = useCurrentExperimentStore();
</script>

<template>
  <ProbeInspector
    v-if="currentExperiment.selectedInspectable?.inspectableKind === 'probe'"
    :probe="currentExperiment.selectedInspectable"
  />
</template>

<style lang="sass" scoped></style>
