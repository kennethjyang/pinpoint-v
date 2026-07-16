<script lang="ts" setup>
import { ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { getVendors } from "@/features/probe";

const vendor = ref<string | null>(null);
const vendors = computedAsync(async () => await getVendors());

const searchQuery = ref<string | null>(null);
</script>

<template>
  <q-card>
    <q-card-section>
      <p class="text-h5">Probe Library</p>
      <q-select v-model="vendor" :options="vendors" label="Vendor" />

      <template v-if="vendor">
        <q-input v-model="searchQuery" clearable label="Search">
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </template>
    </q-card-section>
  </q-card>
</template>

<style lang="sass" scoped></style>
