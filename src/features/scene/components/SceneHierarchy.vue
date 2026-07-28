<script lang="ts" setup>
import { useQuasar } from "quasar";
import { ProbeLibraryDialog } from "@/features/probe";
import { useProbeLibraryStore } from "@/stores/probe-library.store";

const $q = useQuasar();
const probeLibrary = useProbeLibraryStore();
</script>

<template>
  <div class="column">
    <q-btn-dropdown color="primary" dropdown-icon="add" label="Add Probe">
      <q-list>
        <q-item v-for="probe of probeLibrary.library" v-close-popup clickable>
          <q-item-section>
            <q-item-label>
              {{ probe.annotations!.manufacturer }}
              {{ probe.annotations!.model_name }}
            </q-item-label>
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
      <q-item>
        <q-item-section>Probe 1</q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style lang="sass" scoped></style>
