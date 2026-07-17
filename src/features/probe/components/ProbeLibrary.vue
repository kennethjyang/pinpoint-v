<script lang="ts" setup>
import { ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { getProbeNames, getVendors } from "@/features/probe";

const tab = ref("mine");

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
  <q-card class="probe-library">
    <q-card-section>
      <p class="text-h5">Probe Library</p>
      <q-tabs v-model="tab">
        <q-tab label="My Library" name="mine" />
        <q-tab label="Add Probes" name="add" />
      </q-tabs>
      <q-separator />
      <q-tab-panels v-model="tab" animated>
        <q-tab-panel name="mine"> </q-tab-panel>
        <q-tab-panel name="add">
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
                <q-item-section side>
                  <q-btn flat icon="add" round />
                </q-item-section>
              </q-item>
            </q-list>
          </template>
        </q-tab-panel>
      </q-tab-panels>
    </q-card-section>
  </q-card>
</template>

<style lang="sass" scoped>
.probe-library
  min-width: 25vw
  width: fit-content
.probe-list
  max-height: 30vh
  overflow-y: auto
</style>
