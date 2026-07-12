<script lang="ts" setup>
import { computed, ref } from "vue";
import { AtlasPicker } from "@/features/atlas-picker";
import { Atlas } from "@/models/atlas.model";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

const name = ref<string | null>(null);
const atlas = ref<Atlas | null>(null);

const currentExperimentStore = useCurrentExperimentStore();

/**
 * Whether the Create button should be disabled.
 */
const isCreateDisabled = computed(() => !name.value || !atlas.value);

/**
 * Create a new experiment with the given name and atlas.
 */
function create() {
  if (name.value && atlas.value) {
    currentExperimentStore.create(name.value, atlas.value);
  }
}
</script>

<template>
  <q-card class="new-experiment">
    <q-card-section class="q-gutter-y-md">
      <p class="text-h5">{{ $t("newExperiment.title") }}</p>

      <q-input
        v-model="name"
        clearable
        :label="$t('newExperiment.experimentName')"
      />

      <AtlasPicker v-model="atlas" />
    </q-card-section>
    <q-card-actions align="right">
      <q-btn
        color="positive"
        icon="add"
        :label="$t('newExperiment.create')"
        :disable="isCreateDisabled"
        v-close-popup
        @click="create"
      >
        <q-tooltip v-if="isCreateDisabled">
          {{ $t("newExperiment.pickNameAndAtlas") }}
        </q-tooltip>
      </q-btn>
    </q-card-actions>
  </q-card>
</template>

<style lang="sass" scoped>
.new-experiment
  min-width: 25vw
  width: fit-content
</style>
