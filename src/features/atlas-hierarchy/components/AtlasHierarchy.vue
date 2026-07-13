<script lang="ts" setup>
import { ref, useTemplateRef, watch, watchPostEffect } from "vue";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";
import { AtlasStructure } from "@/models/atlas-metadata.model";
import { QTree } from "quasar";

interface TreeModel {
  label: string;
  fullName: string;
  color: string;
  children: TreeModel[];
}

const currentAtlas = useCurrentAtlas();

const tree = useTemplateRef<QTree>("tree");

const filter = ref<string | null>(null);
const hierarchy = ref<TreeModel[]>([]);
const visible = ref<string[]>([]);

// Update the tree data to match the current atlas.
watch(
  currentAtlas.metadata,
  metadata => {
    const { rootId, structures } = metadata ?? {};
    if (!rootId || !structures || !structures[rootId]) return;

    // Build from root but exclude it.
    hierarchy.value = buildHierarchyEntry(
      structures[rootId],
      structures
    ).children;
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
  // Convert name to title case.
  const titleCaseName = structure.name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return {
    label: structure.acronym.toUpperCase(),
    fullName: titleCaseName,
    color: `rgb(${structure.color[0]} ${structure.color[1]} ${structure.color[2]})`,
    children: structure.childrenIds.flatMap(id =>
      structures[id] ? [buildHierarchyEntry(structures[id], structures)] : []
    )
  };
}
</script>

<template>
  <div class="fit column">
    <q-input v-model="filter" :label="$t('atlasHierarchy.search')" clearable>
      <template #prepend>
        <q-icon name="search" />
      </template>
    </q-input>
    <q-scroll-area class="col">
      <q-tree
        ref="tree"
        :filter="filter ?? ''"
        :nodes="hierarchy"
        v-model:ticked="visible"
        dense
        node-key="label"
        no-transition
        tick-strategy="strict"
      >
        <template #default-header="{ node }">
          <div class="row items-center q-gutter-x-xs no-wrap">
            <q-icon
              :style="{ color: node.color }"
              name="radio_button_checked"
            />
            <b>{{ node.label }}</b>
            <span class="ellipsis">{{ node.fullName }}</span>
          </div>
        </template>
      </q-tree>
    </q-scroll-area>
  </div>
</template>

<style lang="sass" scoped></style>
