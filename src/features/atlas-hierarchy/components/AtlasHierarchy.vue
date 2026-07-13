<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch, watchPostEffect } from "vue";
import { useFuse } from "@vueuse/integrations/useFuse";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";
import { AtlasStructure } from "@/models/atlas.model";
import { QScrollArea, QTree } from "quasar";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

interface HierarchyModel {
  id: number;
  acronym: string;
  fullName: string;
  color: string;
  children: HierarchyModel[];
}

// Global state.
const currentExperiment = useCurrentExperimentStore();
const currentAtlas = useCurrentAtlas();

// Components.
const tree = useTemplateRef<QTree>("tree");
const scrollArea = useTemplateRef<QScrollArea>("scrollArea");

// Local state.
const filter = ref<string | null>(null);
const hierarchy = ref<HierarchyModel[]>([]);

// Update the tree data to match the current atlas.
watch(
  currentAtlas.metadata,
  metadata => {
    const { rootId, structures } = metadata ?? {};
    if (!rootId || !structures) return;

    // Build from root but exclude it.
    hierarchy.value = buildHierarchy(rootId, structures)?.children ?? [];
  },
  { immediate: true }
);

// Ensure the tree is always fully expanded.
watchPostEffect(() => {
  if (hierarchy.value.length > 0) {
    tree.value?.expandAll();
  }
});

// Expose scroll area target for the search result virtual scroll.
const scrollAreaTarget = computed(() => scrollArea.value?.getScrollTarget());

// Flatten the hierarchy into a searchable list for fuzzy matching.
const flatNodes = computed(() => {
  const flattened: HierarchyModel[] = [];
  const walk = (nodes: HierarchyModel[]) => {
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
  fuseOptions: { keys: ["acronym", "fullName"] }
});

// Search mode: replace tree with flat result list.
const isSearching = computed(() => (filter.value ?? "").trim().length > 0);
const searchResults = computed(() => results.value.map(r => r.item));

// Tick helpers for the search list.

/**
 * Is the structure visible on the atlas in the experiment.
 * @param id ID of the structure to check.
 */
function isVisible(id: number) {
  return currentExperiment.visibleStructures.includes(id);
}

/**
 * Set the visibility of the structure in the atlas.
 * @param id ID of the structure to set the visibility of.
 * @param value Is the structure visible or not.
 */
function setVisible(id: number, value: boolean) {
  if (value) {
    if (!currentExperiment.visibleStructures.includes(id)) {
      currentExperiment.visibleStructures.push(id);
    }
  } else {
    const index = currentExperiment.visibleStructures.indexOf(id);
    if (index !== -1) {
      currentExperiment.visibleStructures.splice(index, 1);
    }
  }
}

/**
 * Build a tree hierarchy from a structure metadata.
 * @param id Index of the current structure in `structures` to recurse down.
 * @param structures All structures in atlas metadata.
 */
function buildHierarchy(
  id: number,
  structures: AtlasStructure[]
): HierarchyModel | null {
  // Get the structure.
  const structure = structures[id];
  if (!structure) return null;

  // Convert name to title case.
  const titleCaseName = structure.name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return {
    id,
    acronym: structure.acronym.toUpperCase(),
    fullName: titleCaseName,
    color: `rgb(${structure.color[0]} ${structure.color[1]} ${structure.color[2]})`,
    children: structure.childrenIds.flatMap(
      childId => buildHierarchy(childId, structures) ?? []
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
    <q-scroll-area ref="scrollArea" class="col">
      <q-virtual-scroll
        v-if="isSearching"
        :items="searchResults"
        :scroll-target="scrollAreaTarget"
        dense
      >
        <template #default="{ item: node }">
          <q-item :key="node.id" dense>
            <q-item-section side>
              <q-checkbox
                :model-value="isVisible(node.id)"
                dense
                @update:model-value="visible => setVisible(node.id, visible)"
              />
            </q-item-section>
            <q-item-section>
              <div class="row items-center q-gutter-x-xs no-wrap">
                <q-icon
                  :style="{ color: node.color }"
                  name="radio_button_checked"
                />
                <b>{{ node.acronym }}</b>
                <span class="text-no-wrap">{{ node.fullName }}</span>
              </div>
            </q-item-section>
          </q-item>
        </template>
      </q-virtual-scroll>
      <q-tree
        v-else
        ref="tree"
        :nodes="hierarchy"
        v-model:ticked="currentExperiment.visibleStructures"
        dense
        no-transition
        node-key="id"
        tick-strategy="strict"
      >
        <template #default-header="{ node }">
          <div class="row items-center q-gutter-x-xs no-wrap">
            <q-icon
              :style="{ color: node.color }"
              name="radio_button_checked"
            />
            <b>{{ node.acronym }}</b>
            <span class="text-no-wrap">{{ node.fullName }}</span>
          </div>
        </template>
      </q-tree>
    </q-scroll-area>
  </div>
</template>

<style lang="sass" scoped></style>
