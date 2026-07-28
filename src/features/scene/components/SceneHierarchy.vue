<script lang="ts" setup>
import { useQuasar } from "quasar";
import { buildProbe, ProbeLibraryDialog } from "@/features/probe";
import { useProbeLibraryStore } from "@/stores/probe-library.store";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { ref } from "vue";
import { Entity } from "../models/entity.model";

const $q = useQuasar();
const probeLibrary = useProbeLibraryStore();
const currentExperiment = useCurrentExperimentStore();

const selectedEntity = ref<Entity | null>(null);

/**
 * Helper to determine if the passed entity is the actively selected one.
 * @param entity
 */
function isSelected(entity: Entity): boolean {
  if (!selectedEntity.value) return false;

  if (selectedEntity.value.kind !== entity.kind) return false;

  switch (selectedEntity.value.kind) {
    case "probe":
      return selectedEntity.value.name === entity.name;
    default:
      return false;
  }
}
</script>

<template>
  <div class="column">
    <q-btn-dropdown color="primary" dropdown-icon="add" label="Add Probe">
      <q-list>
        <q-item
          v-for="probeInterfaceProbe of probeLibrary.library"
          v-close-popup
          v-ripple
          clickable
          @click="currentExperiment.addProbe(buildProbe(probeInterfaceProbe))"
        >
          <q-item-section>
            {{ probeInterfaceProbe.annotations!.manufacturer }}
            {{ probeInterfaceProbe.annotations!.model_name }}
          </q-item-section>
        </q-item>
        <q-separator />
        <q-item
          v-close-popup
          clickable
          @click="$q.dialog({ component: ProbeLibraryDialog })"
        >
          <q-item-section>
            <q-item-label><b>Manage probes...</b></q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>
    <q-list separator>
      <q-item
        v-for="probe of currentExperiment.probes"
        :key="probe.name"
        v-ripple
        :active="isSelected(probe)"
        clickable
        @click="selectedEntity = probe"
      >
        <q-item-section side>
          <q-icon :style="{ color: probe.color }" name="radio_button_checked" />
        </q-item-section>
        <q-item-section>{{ probe.name }}</q-item-section>
        <q-item-section side>
          <div class="row">
            <q-btn flat icon="visibility" round />
            <q-btn flat icon="delete" round />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style lang="sass" scoped></style>
