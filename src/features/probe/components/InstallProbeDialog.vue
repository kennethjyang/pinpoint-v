<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { computedAsync } from "@vueuse/core";
import {
  buildProbeOverviewImageSrc,
  getProbeInterfaceProbe,
  getProbeNames,
  getVendors,
  ProbeInterfaceProbe
} from "@/features/probe";
import { useDialogPluginComponent } from "quasar";

// Setup dialog.
defineEmits([...useDialogPluginComponent.emits]);
const { dialogRef, onDialogHide } = useDialogPluginComponent();

const selectedVendorName = ref<string | null>(null);
const vendors = computedAsync<string[]>(async () => await getVendors());

const searchQuery = ref<string | null>(null);

const selectedProbeName = ref<string | null>(null);
watch(selectedVendorName, () => {
  selectedProbeName.value = null;
});
const probeNames = computedAsync<string[]>(async () => {
  if (!selectedVendorName.value) return [];
  return await getProbeNames(selectedVendorName.value);
});

const selectedProbeInterfaceProbe = computedAsync<ProbeInterfaceProbe | null>(
  async () => {
    if (!selectedVendorName.value || !selectedProbeName.value) return null;
    return await getProbeInterfaceProbe(
      selectedVendorName.value,
      selectedProbeName.value
    );
  }
);
const selectedProbeOverviewImageSrc = computed<string>(() => {
  if (!selectedVendorName.value || !selectedProbeName.value) return "";

  return buildProbeOverviewImageSrc(
    selectedVendorName.value,
    selectedProbeName.value
  );
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
              @click="selectedProbeName = probeName"
            >
              <q-item-section>{{ probeName }}</q-item-section>
            </q-item>
          </q-list>

          <q-img
            v-if="selectedProbeOverviewImageSrc !== ''"
            :src="selectedProbeOverviewImageSrc"
            fit="contain"
          />
        </template>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn icon="upload" label="Upload Custom Probe" />
        <q-btn color="primary" icon="add" label="Add" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style lang="sass" scoped>
.probe-list
  max-height: 30vh
  overflow-y: auto
</style>
