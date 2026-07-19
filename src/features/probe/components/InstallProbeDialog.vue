<script lang="ts" setup>
import { computed, ref } from "vue";
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
          <div class="row q-gutter-x-sm">
            <div class="col">
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
            </div>

            <template v-if="selectedProbeOverviewImageSrc !== ''">
              <q-separator inset vertical />

              <q-img
                :src="selectedProbeOverviewImageSrc"
                class="col probe-image"
              />
            </template>
          </div>
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
.install-card
  min-width: 25vw
.probe-list
  max-height: 30vh
  overflow-y: auto
.probe-image
  min-width: 30vw
</style>
