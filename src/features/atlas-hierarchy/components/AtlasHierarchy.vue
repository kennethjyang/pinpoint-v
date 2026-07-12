<script lang="ts" setup>
import { ref, useTemplateRef, watch, watchPostEffect } from "vue";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";
import { AtlasStructure } from "@/models/atlas-metadata.model";
import { QTree } from "quasar";

interface TreeModel {
  label: string;
  children: TreeModel[];
}

const currentAtlas = useCurrentAtlas();

const filter = ref<string | null>(null);
const hierarchy = ref<TreeModel[]>([]);
const tree = useTemplateRef<QTree>("tree");

// Update the tree data to match the current atlas.
watch(
  currentAtlas.metadata,
  metadata => {
    const { rootId, structures } = metadata ?? {};
    if (!rootId || !structures || !structures[rootId]) return;

    hierarchy.value = [buildHierarchyEntry(structures[rootId], structures)];
  },
  { immediate: true }
);

// Ensure the tree is always fully expanded.
watchPostEffect(() => {
  if (hierarchy.value.length > 0) {
    tree.value?.expandAll();
  }
});

function buildHierarchyEntry(
  structure: AtlasStructure,
  structures: AtlasStructure[]
): TreeModel {
  const titleCaseName = structure.name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  // Only include acronym if it's different.
  const label =
    structure.name === structure.acronym
      ? titleCaseName
      : `${titleCaseName} (${structure.acronym.toUpperCase()})`;

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
    ref="tree"
    :filter="filter ?? ''"
    :nodes="hierarchy"
    node-key="label"
  />
</template>

<style lang="sass" scoped></style>
