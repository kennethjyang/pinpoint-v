<script lang="ts" setup>
import { useQuasar } from "quasar";
import { ProbeLibraryDialog } from "@/features/probe";

const $q = useQuasar();
</script>

<template>
  <div class="column">
    <q-btn-dropdown color="primary" dropdown-icon="add" label="Add Probe">
      <q-list>
        <q-item
          v-close-popup
          clickable
          @click="$q.dialog({ component: ProbeLibraryDialog })"
        >
          <q-item-section
            ><q-item-label>Manage probes...</q-item-label></q-item-section
          >
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
