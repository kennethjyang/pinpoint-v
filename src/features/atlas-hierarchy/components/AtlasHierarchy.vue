<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch, watchPostEffect } from "vue";
import { useFuse } from "@vueuse/integrations/useFuse";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";
import { AtlasStructure } from "@/models/atlas.model";
import { QTree } from "quasar";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

interface TreeModel {
  label: string;
  fullName: string;
  color: string;
  children: TreeModel[];
}

// Global state.
const currentExperiment = useCurrentExperimentStore();
const currentAtlas = useCurrentAtlas();

// Components.
const tree = useTemplateRef<QTree>("tree");

// Local state.
const filter = ref<string | null>(null);
const hierarchy = ref<TreeModel[]>([]);

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

// Flatten the hierarchy into a searchable list for fuzzy matching.
const flatNodes = computed(() => {
  const flattened: TreeModel[] = [];
  const walk = (nodes: TreeModel[]) => {
    for (const node of nodes) {
      flattened.push(node);
      walk(node.children);
    }
  };
  walk(hierarchy.value);
  return flattened;
});

// Fuzzy search across the acronym (label) and the full name.
const searchQuery = computed(() => filter.value ?? "");
const { results } = useFuse(searchQuery, flatNodes, {
  fuseOptions: { keys: ["label", "fullName"] }
});

// Search mode: replace tree with flat result list.
const isSearching = computed(() => (filter.value ?? "").trim().length > 0);
const searchResults = computed(() => results.value.map(r => r.item));

// Checkbox helpers for the flat list.
function isVisible(label: string) {
  return currentExperiment.visibleStructures.includes(label);
}

function setVisible(label: string, value: boolean) {
  if (value) {
    if (!currentExperiment.visibleStructures.includes(label)) {
      currentExperiment.visibleStructures.push(label);
    }
  } else {
    const index = currentExperiment.visibleStructures.indexOf(label);
    if (index !== -1) {
      currentExperiment.visibleStructures.splice(index, 1);
    }
  }
}

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
    label: structure.acronym.toLowerCase(),
    fullName: titleCaseName,
    color: `rgb(${structure.color[0]} ${structure.color[1]} ${structure.color[2]})`,
    children: structure.childrenIds.flatMap(id =>
      structures[id] ? buildHierarchyEntry(structures[id], structures) : []
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
      <q-list v-if="isSearching" dense>
        <q-item v-for="node in searchResults" :key="node.label">
          <q-item-section side>
            <q-checkbox
              dense
              :model-value="isVisible(node.label)"
              @update:model-value="v => setVisible(node.label, v)"
            />
          </q-item-section>
          <q-item-section>
            <div class="row items-center q-gutter-x-xs no-wrap">
              <q-icon
                :style="{ color: node.color }"
                name="radio_button_checked"
              />
              <b>{{ node.label.toUpperCase() }}</b>
              <span class="ellipsis">{{ node.fullName }}</span>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
      <q-tree
        v-else
        ref="tree"
        :nodes="hierarchy"
        v-model:ticked="currentExperiment.visibleStructures"
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
            <b>{{ node.label.toUpperCase() }}</b>
            <span class="ellipsis">{{ node.fullName }}</span>
          </div>
        </template>
      </q-tree>
    </q-scroll-area>
  </div>
</template>

<style lang="sass" scoped></style>
