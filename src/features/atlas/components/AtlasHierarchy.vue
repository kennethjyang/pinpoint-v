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
  getTerminologyRows,
  HierarchyModel,
  toTitleCase
} from "@/features/atlas";
import { QScrollArea, QTree, useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { computedAsync } from "@vueuse/core";

const currentExperiment = useCurrentExperimentStore();
const $q = useQuasar();
const { t } = useI18n();

// Components.
const tree = useTemplateRef<QTree>("tree");
const scrollArea = useTemplateRef<QScrollArea>("scroll-area");

// Local state.
const filter = ref<string | null>(null);
const hierarchy = ref<HierarchyModel[]>([]);

// Expose scroll area target for the search result virtual scroll.
const scrollAreaTarget = computed(() => scrollArea.value?.getScrollTarget());

// Fetch the terminology rows for the current atlas, used both to build the
// tree and as the searchable list for fuzzy matching.
const terminologyRows = computedAsync(async () => {
  const rows = await getTerminologyRows(currentExperiment.atlas);
  if (rows.length === 0) notifyLoadFailed();
  return rows;
}, []);

// Fuzzy search across the acronym (label) and the full name.
const searchQuery = computed(() => filter.value ?? "");
const { results } = useFuse(searchQuery, terminologyRows, {
  fuseOptions: { keys: ["name", "abbreviation"] }
});

// Search mode: replace tree with flat result list.
const isSearching = computed(() => (filter.value ?? "").trim().length > 0);
const searchResults = computed(() => results.value.map(r => r.item));

/**
 * Notify that the atlas structures failed to load.
 */
function notifyLoadFailed() {
  $q.notify({
    message: t("atlasHierarchy.loadFailed"),
    caption: t("atlasHierarchy.loadFailedCaption"),
    color: "negative",
    icon: "error"
  });
}

// Update the tree data to match the current atlas.
watchEffect(() => {
  // Build from root but exclude it.
  hierarchy.value = buildHierarchy(terminologyRows.value)?.children ?? [];
});

// Ensure the tree is always fully expanded.
watchPostEffect(() => {
  if (hierarchy.value.length > 0) {
    tree.value?.expandAll();
  }
});
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
          <q-item :key="node.identifier" dense>
            <q-item-section side>
              <q-checkbox
                :model-value="
                  currentExperiment.isStructureVisible(node.identifier)
                "
                dense
                @update:model-value="
                  visible =>
                    currentExperiment.setStructureVisibility(
                      node.identifier,
                      visible
                    )
                "
              />
            </q-item-section>
            <q-item-section>
              <div class="row items-center q-gutter-x-xs no-wrap">
                <q-icon
                  :style="{ color: node.color_hex_triplet }"
                  name="radio_button_checked"
                />
                <b>{{ node.abbreviation }}</b>
                <span class="text-no-wrap">{{ toTitleCase(node.name) }}</span>
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
        node-key="identifier"
        tick-strategy="strict"
      >
        <template #default-header="{ node }">
          <div class="row items-center q-gutter-x-xs no-wrap">
            <q-icon
              :style="{ color: node.color }"
              name="radio_button_checked"
            />
            <b>{{ node.abbreviation }}</b>
            <span class="text-no-wrap">{{ node.name }}</span>
          </div>
        </template>
      </q-tree>
    </q-scroll-area>

    <template v-if="currentExperiment.visibleStructures.length">
      <q-btn
        icon="clear_all"
        :label="$t('atlasHierarchy.clear')"
        @click="currentExperiment.clearVisibleStructures"
      />
    </template>
  </div>
</template>

<style lang="sass" scoped></style>
