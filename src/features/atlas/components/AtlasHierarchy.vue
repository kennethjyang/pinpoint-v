<script lang="ts" setup>
import { computed, ref } from "vue";
import { useFuzzyFilter } from "@/composable/useFuzzyFilter";
import { flattenHierarchy } from "../api/hierarchy.api";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import {
  clearVisibleStructures,
  isStructureVisible,
  setStructureVisibility
} from "@/features/experiment";

const currentExperiment = useCurrentExperimentStore();

const filter = ref<string | null>(null);

// DFS-flattened hierarchy, carrying each row's indent guides.
const items = computed(() =>
  flattenHierarchy(currentExperiment.terminologyRows)
);

// Fuzzy search across the abbreviation (label) and the full name. A
// whitespace-only filter is treated as blank, keeping the hierarchy order.
const { isSearching, filtered: displayedItems } = useFuzzyFilter(
  computed(() => filter.value ?? ""),
  items,
  { keys: ["name", "abbreviation"] },
  query => query.trim().length === 0
);
</script>

<template>
  <div class="column full-height q-gutter-y-sm">
    <q-input v-model="filter" :label="$t('atlasHierarchy.search')" clearable>
      <template #prepend>
        <q-icon name="search" />
      </template>
    </q-input>

    <!--      :virtual-scroll-item-size="32"-->
    <q-virtual-scroll
      v-slot="{ item, index }"
      :items="displayedItems"
      class="col scroll"
    >
      <q-item :key="index" dense>
        <q-item-section no-wrap>
          <template v-if="!isSearching">
            <span
              v-for="(guide, index) in item.guides"
              :key="index"
              :class="`guide--${guide}`"
              class="guide"
            />
          </template>
          <div class="row q-gutter-x-xs items-center no-wrap">
            <q-checkbox
              :model-value="
                isStructureVisible(
                  currentExperiment.experiment,
                  item.identifier
                )
              "
              dense
              @update:model-value="
                visible =>
                  setStructureVisibility(
                    currentExperiment.experiment,
                    item.identifier,
                    visible
                  )
              "
            />
            <q-icon
              :style="{ color: item.color }"
              name="radio_button_checked"
              size="sm"
            />
            <b>{{ item.abbreviation }}</b>
            <span class="text-no-wrap">{{ item.name }}</span>
          </div>
        </q-item-section>
      </q-item>
      <!--      <template #default="{ item }">-->
      <!--        <div-->
      <!--          :key="item.identifier"-->
      <!--          class="hierarchy-row row items-center no-wrap"-->
      <!--        >-->
      <!--        </div>-->
      <!--      </template>-->
    </q-virtual-scroll>

    <template v-if="currentExperiment.visibleStructures.length">
      <q-btn
        icon="clear_all"
        :label="$t('atlasHierarchy.clear')"
        @click="clearVisibleStructures(currentExperiment.experiment)"
      />
    </template>
  </div>
</template>

<style lang="sass" scoped>
$guide-width: 2px

.column
  flex-wrap: nowrap

.hierarchy-row
  height: 32px
  width: max-content
  min-width: 100%

.guide
  flex: 0 0 1rem
  align-self: stretch
  position: relative

.guide--line::before, .guide--tee::before
  content: ''
  position: absolute
  top: 0
  left: 50%
  height: 100%
  border-left: $guide-width solid $separator-color

.guide--elbow::before
  content: ''
  position: absolute
  top: 0
  left: 50%
  height: 50%
  border-left: $guide-width solid $separator-color

.guide--tee::after, .guide--elbow::after
  content: ''
  position: absolute
  top: 50%
  left: calc(50% + $guide-width / 2)
  width: 50%
  margin-top: -($guide-width * 0.5)
  border-top: $guide-width solid $separator-color

body.body--dark
  .guide--line::before, .guide--tee::before
    border-left-color: $separator-dark-color

  .guide--elbow::before
    border-left-color: $separator-dark-color

  .guide--tee::after, .guide--elbow::after
    border-top-color: $separator-dark-color
</style>
