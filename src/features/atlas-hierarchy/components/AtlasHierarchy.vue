<script lang="ts" setup>
import { ref } from "vue";

const filter = ref<string | null>(null);
const hierarchy = ref<[]>([]);
</script>

<template>
  <q-input v-model="filter" :label="$t('atlasHierarchy.search')" clearable>
    <template #prepend>
      <q-icon name="search" />
    </template>
  </q-input>
  <q-tree
    :filter="filter ?? ''"
    :nodes="hierarchy"
    default-expand-all
    node-key="label"
  />
</template>

<style lang="sass" scoped></style>
