<script lang="ts" setup>
import { computed, ref } from "vue";
import { Atlas, AtlasPicker, fetchAtlasMetadata } from "@/features/atlas";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { useDialogPluginComponent } from "quasar";

/**
 * Reference coordinate used when an atlas's metadata (and thus its default
 * reference coordinate) can't be fetched.
 */
const FALLBACK_REFERENCE_COORDINATE: [number, number, number] = [0, 0, 0];

const currentExperimentStore = useCurrentExperimentStore();

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide } = useDialogPluginComponent();

const name = ref<string | null>(null);
const atlas = ref<Atlas | null>(null);

/**
 * Whether the Create button should be disabled.
 */
const isCreateDisabled = computed(() => !name.value || !atlas.value);

/**
 * Create a new experiment with the given name and atlas, seeding its
 * reference coordinate from the atlas's default reference coordinate.
 */
async function create() {
  if (!name.value || !atlas.value) return;

  const metadata = await fetchAtlasMetadata(atlas.value);
  const referenceCoordinate =
    metadata?.defaultReferenceCoordinate ?? FALLBACK_REFERENCE_COORDINATE;

  currentExperimentStore.create(name.value, atlas.value, referenceCoordinate);
}
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
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
        <q-btn v-close-popup label="Cancel" />
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
  </q-dialog>
</template>

<style lang="sass" scoped>
.new-experiment
  min-width: 25vw
  width: fit-content
</style>
