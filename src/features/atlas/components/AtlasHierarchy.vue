<script lang="ts" setup>
import {
  computed,
  ref,
  useTemplateRef,
  watchEffect,
  watchPostEffect
} from "vue";
import { useFuse } from "@vueuse/integrations/useFuse";
import {
  buildHierarchy,
  flattenHierarchy,
  HierarchyModel
} from "@/features/atlas";
import { QScrollArea, QTree } from "quasar";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

const currentExperiment = useCurrentExperimentStore();

// Components.
const tree = useTemplateRef<QTree>("tree");
const scrollArea = useTemplateRef<QScrollArea>("scroll-area");

// Local state.
const filter = ref<string | null>(null);
const hierarchy = ref<HierarchyModel[]>([]);

// Update the tree data to match the current atlas.
watchEffect(() => {
  if (!currentExperiment.metadata) return;
  const { rootId, structures } = currentExperiment.metadata;

  // Build from root but exclude it.
  hierarchy.value = buildHierarchy(rootId, structures)?.children ?? [];
});

// Ensure the tree is always fully expanded.
watchPostEffect(() => {
  if (hierarchy.value.length > 0) {
    tree.value?.expandAll();
  }
});

// Expose scroll area target for the search result virtual scroll.
const scrollAreaTarget = computed(() => scrollArea.value?.getScrollTarget());

// Flatten the hierarchy into a searchable list for fuzzy matching.
const flatNodes = computed(() => flattenHierarchy(hierarchy.value));

// Fuzzy search across the acronym (label) and the full name.
const searchQuery = computed(() => filter.value ?? "");
const { results } = useFuse(searchQuery, flatNodes, {
  fuseOptions: { keys: ["acronym", "fullName"] }
});

// Search mode: replace tree with flat result list.
const isSearching = computed(() => (filter.value ?? "").trim().length > 0);
const searchResults = computed(() => results.value.map(r => r.item));
</script>

<template>
  <div class="fit column q-gutter-y-sm">
    <q-input v-model="filter" :label="$t('atlasHierarchy.search')" clearable>
      <template #prepend>
        <q-icon name="search" />
      </template>
    </q-input>

    <q-scroll-area ref="scroll-area" class="col">
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
                :model-value="currentExperiment.isStructureVisible(node.id)"
                dense
                @update:model-value="
                  visible =>
                    currentExperiment.setStructureVisibility(node.id, visible)
                "
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
        v-model:ticked="currentExperiment.visibleStructures"
        :nodes="hierarchy"
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

    <template v-if="currentExperiment.visibleStructures.length">
      <q-btn
        icon="clear_all"
        label="Clear"
        @click="currentExperiment.clearVisibleStructures"
      />
    </template>
  </div>
</template>

<style lang="sass" scoped></style>
