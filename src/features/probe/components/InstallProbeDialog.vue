<script lang="ts" setup>
import { ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { getProbeNames, getVendors } from "@/features/probe";
import { useDialogPluginComponent } from "quasar";

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide } = useDialogPluginComponent();

const selectedVendorName = ref<string | null>(null);
const vendors = computedAsync<string[]>(async () => await getVendors());

const searchQuery = ref<string | null>(null);

const selectedProbeName = ref<string | null>(null);
const probeNames = computedAsync<string[]>(async () => {
  if (!selectedVendorName.value) return [];
  return await getProbeNames(selectedVendorName.value);
});
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="install-card">
      <q-card-section>
        <p class="text-h5">Install Probe</p>

        <q-select
          v-model="selectedVendorName"
          :options="vendors"
          label="Vendor"
        />

        <template v-if="selectedVendorName">
          <q-input v-model="searchQuery" clearable label="Search">
            <template #prepend>
              <q-icon name="search" />
            </template>
          </q-input>
          <q-list class="probe-list" separator>
            <q-item
              v-for="probeName in probeNames"
              :key="probeName"
              v-ripple
              :active="selectedProbeName === probeName"
              clickable
            >
              <q-item-section>{{ probeName }}</q-item-section>
            </q-item>
          </q-list>
        </template>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style lang="sass" scoped>
.install-card
  min-width: 25vw
  width: fit-content
.probe-list
  max-height: 30vh
  overflow-y: auto
</style>
