<script lang="ts" setup>
import {
  computed,
  onActivated,
  onDeactivated,
  shallowRef,
  useTemplateRef,
  watch
} from "vue";
import { useFuse } from "@vueuse/integrations/useFuse";
import { useRafFn } from "@vueuse/core";
import {
  buildHierarchy,
  flattenHierarchy,
  FlatHierarchyNode,
  HierarchyModel,
  toTitleCase
} from "../api/hierarchy.api";
import { QScrollArea } from "quasar";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

/** Nodes revealed on the first frame - small so the tab paints immediately. */
const INITIAL_REVEAL_CHUNK = 32;

/**
 * Ceiling on nodes revealed per frame. Each frame re-creates vnodes for
 * every already-revealed node but only mounts the new ones, so this bounds
 * the mount cost per frame while the growing vnode pass stays a few
 * milliseconds even at ~1800 nodes (the largest installed atlases).
 */
const MAX_REVEAL_CHUNK = 256;

const currentExperiment = useCurrentExperimentStore();

// Components.
const scrollArea = useTemplateRef<QScrollArea>("scroll-area");

// Local state.
const filter = shallowRef<string | null>(null);
// `shallowRef`, not `ref`: the tree is rebuilt as fresh top-level arrays on
// every reveal frame, so it doesn't need (and shouldn't pay for) Vue's deep
// reactivity while QTree traverses it.
const hierarchy = shallowRef<HierarchyModel[]>([]);
const expandedIdentifiers = shallowRef<number[]>([]);

// Reveal-loop bookkeeping. Not reactive: only `hierarchy` and
// `expandedIdentifiers` need to trigger re-renders, and they're reassigned
// once per frame in `revealChunk`.
let flatNodes: FlatHierarchyNode[] = [];
let revealedByIdentifier = new Map<number, HierarchyModel>();
let revealCursor = 0;
let revealChunkSize = INITIAL_REVEAL_CHUNK;

// Expose scroll area target for the search result virtual scroll.
const scrollAreaTarget = computed(() => scrollArea.value?.getScrollTarget());

// Search mode: replace tree with flat result list.
const isSearching = computed(() => (filter.value ?? "").trim().length > 0);
// Fuzzy search across the abbreviation (label) and the full name. Fed an
// empty list while not searching, so mounting doesn't pay to build a Fuse
// index over every row, and no deep watch is installed on them either.
const searchQuery = computed(() => filter.value ?? "");
const searchableRows = computed(() =>
  isSearching.value ? currentExperiment.terminologyRows : []
);
const { results } = useFuse(searchQuery, searchableRows, {
  fuseOptions: { keys: ["name", "abbreviation"] }
});
const searchResults = computed(() => results.value.map(r => r.item));

/**
 * Reveal the next chunk of nodes, attaching each to its already-revealed
 * parent, then grow the chunk size for the next frame.
 *
 * Nodes are visited in the depth-first order produced by
 * {@link flattenHierarchy}, so a node's parent is always already revealed by
 * the time the node itself is reached.
 */
function revealChunk() {
  const end = Math.min(revealCursor + revealChunkSize, flatNodes.length);
  for (; revealCursor < end; revealCursor++) {
    const { node, parentIdentifier } = flatNodes[revealCursor]!;
    revealedByIdentifier.set(node.identifier, node);
    if (parentIdentifier === null) {
      hierarchy.value.push(node);
    } else {
      const parent = revealedByIdentifier.get(parentIdentifier);
      parent?.children.push(node);
      if (parent && !expandedIdentifiers.value.includes(parentIdentifier)) {
        expandedIdentifiers.value.push(parentIdentifier);
      }
    }
  }

  // Reassign fresh top-level arrays so the shallow refs pick up the change.
  hierarchy.value = [...hierarchy.value];
  expandedIdentifiers.value = [...expandedIdentifiers.value];

  if (revealCursor >= flatNodes.length) {
    revealLoop.pause();
  } else {
    revealChunkSize = Math.min(revealChunkSize * 2, MAX_REVEAL_CHUNK);
  }
}

const revealLoop = useRafFn(revealChunk, { immediate: false });

// Rebuild and progressively reveal the tree whenever the current atlas's
// terminology rows change.
//
// This is a `watch` over an explicit source, not a `watchEffect`: the
// callback body calls `revealLoop.resume()`/`pause()`, which read
// `revealLoop.isActive` - a `watchEffect` would auto-track that read as a
// dependency and then re-trigger itself the moment the callback wrote to it,
// resetting the fill on every microtask before a single frame could render.
watch(
  () => currentExperiment.terminologyRows,
  terminologyRows => {
    // Build from root but exclude it.
    const roots = buildHierarchy(terminologyRows)?.children;
    flatNodes = flattenHierarchy(roots ?? []);
    revealedByIdentifier = new Map();
    revealCursor = 0;
    revealChunkSize = INITIAL_REVEAL_CHUNK;
    hierarchy.value = [];
    expandedIdentifiers.value = [];

    if (flatNodes.length > 0) {
      revealLoop.resume();
    } else {
      revealLoop.pause();
    }
  },
  { immediate: true }
);

// Pause the reveal loop while this tab isn't visible - `keep-alive` keeps
// the component (and any unfinished fill) alive across tab switches, and
// filling while another tab is on screen would just compete for frames.
onDeactivated(() => revealLoop.pause());
onActivated(() => {
  if (revealCursor < flatNodes.length) revealLoop.resume();
});
</script>

<template>
  <div class="fit column q-gutter-y-sm">
    <q-input v-model="filter" :label="$t('atlasHierarchy.search')" clearable>
      <template #prepend>
        <q-icon name="search" />
      </template>
    </q-input>

    <q-linear-progress
      v-if="revealCursor < flatNodes.length"
      :value="flatNodes.length ? revealCursor / flatNodes.length : 0"
      indeterminate
    />

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
        v-model:expanded="expandedIdentifiers"
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
