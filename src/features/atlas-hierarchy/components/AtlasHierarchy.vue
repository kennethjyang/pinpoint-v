<script lang="ts" setup>
import { ref, watch } from "vue";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";
import { AtlasStructure } from "@/models/atlas-metadata.model";

interface TreeModel {
  label: string;
  children: TreeModel[];
}

const currentAtlas = useCurrentAtlas();

const filter = ref<string | null>(null);
const hierarchy = ref<TreeModel[]>([]);

watch(
  currentAtlas.metadata,
  metadata => {
    const { rootId, structures } = metadata ?? {};
    if (!rootId || !structures || !structures[rootId]) return;

    hierarchy.value = [buildHierarchyEntry(structures[rootId], structures)];
  },
  { immediate: true }
);

function buildHierarchyEntry(
  structure: AtlasStructure,
  structures: AtlasStructure[]
): TreeModel {
  // Only include acronym if it's different.
  const label =
    structure.name === structure.acronym
      ? structure.name
      : `${structure.name} (${structure.acronym.toUpperCase()})`;

  return {
    label,
    children: structure.childrenIds.flatMap(id =>
      structures[id] ? [buildHierarchyEntry(structures[id], structures)] : []
    )
  };
}
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
