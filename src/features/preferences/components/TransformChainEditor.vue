<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import TransformChainStepRow from "./TransformChainStepRow.vue";
import CommittedInput from "@/components/CommittedInput.vue";
import { useDragReorder } from "@/composable/useDragReorder";
import { useValidationRules } from "@/composable/useValidationRules";
import {
  copyTransformChain,
  DEFAULT_TRANSFORM_CHAIN_ID,
  findTransformChain,
  getTransformChainLabel,
  getTransformChains,
  isTransformInputBound,
  type TransformChain,
  TRANSFORM_INPUT_GROUPS,
  type TransformInputComponent,
  type TransformInputGroup,
  type TransformInputRef
} from "@/features/scene";
import { usePreferencesStore } from "@/stores/preferences.store";

/**
 * Select value standing for no input at all. Every other option is keyed
 * `group:component`, matching `TransformChainStepRow`.
 */
const NO_INPUT_KEY = "";

/** Every component of an input group, in order. */
const COMPONENTS: readonly TransformInputComponent[] = [0, 1, 2];

const { t } = useI18n();
const preferences = usePreferencesStore();
const { requiredName: nameRules } = useValidationRules();
const {
  draggedIndex,
  dropTargetIndex,
  startDrag,
  dragOverRow,
  dropRow,
  endDrag
} = useDragReorder((fromIndex, toIndex) => reorderStep(fromIndex, toIndex));

const editedChainId = ref(DEFAULT_TRANSFORM_CHAIN_ID);

const chains = computed(() => getTransformChains(preferences.transformChains));
const chain = computed(() =>
  findTransformChain(chains.value, editedChainId.value)
);

const chainName = computed({
  get: () => chain.value.name,
  set: (value: string) => (chain.value.name = value.trim())
});

const inputOptions = computed(() =>
  TRANSFORM_INPUT_GROUPS.flatMap(group =>
    COMPONENTS.map(component => ({
      label: t("preferences.transformInputOption", {
        group: t(`transformChain.${group}`),
        name: preferences.transformInputNames[group][component]
      }),
      value: `${group}:${component}`
    }))
  )
);

const depthAxisOptions = computed(() => [
  { label: t("preferences.noDepthAxis"), value: NO_INPUT_KEY },
  ...inputOptions.value
]);

const depthAxisKey = computed({
  get: () => {
    const axis = chain.value.depthAxis;
    return axis ? `${axis.group}:${axis.component}` : NO_INPUT_KEY;
  },
  set: (key: string) => {
    chain.value.depthAxis = key === NO_INPUT_KEY ? null : parseInputKey(key);
  }
});

const unusedInputsCaption = computed(() => {
  const names = TRANSFORM_INPUT_GROUPS.flatMap(group =>
    COMPONENTS.filter(
      component => !isTransformInputBound(chain.value, { group, component })
    ).map(component => preferences.transformInputNames[group][component])
  );

  return names.length === 0
    ? t("preferences.allInputsUsed")
    : t("preferences.unusedInputs", { names: names.join(", ") });
});

/**
 * Display name of a chain: its own, or an i18n lookup for a built-in.
 * @param candidate Chain to name.
 */
function chainLabel(candidate: TransformChain): string {
  return getTransformChainLabel(candidate, key => t(key));
}

/** Append an editable copy of the shown chain and edit it. */
function addChain(): void {
  const copy = copyTransformChain(
    chain.value,
    t("preferences.chainCopyName", {
      name: chainLabel(chain.value)
    })
  );
  preferences.transformChains.push(copy);
  editedChainId.value = copy.id;
}

/**
 * Delete a user chain, falling back to the built-in default wherever it was
 * still referenced.
 * @param deleted Chain to delete.
 */
function deleteChain(deleted: TransformChain): void {
  const chainIndex = preferences.transformChains.findIndex(
    userChain => userChain.id === deleted.id
  );
  if (chainIndex === -1) return;

  preferences.transformChains.splice(chainIndex, 1);
  if (preferences.defaultProbeChainId === deleted.id) {
    preferences.defaultProbeChainId = DEFAULT_TRANSFORM_CHAIN_ID;
  }
  if (editedChainId.value === deleted.id) {
    editedChainId.value = DEFAULT_TRANSFORM_CHAIN_ID;
  }
}

/** Append a translation step reading nothing to the edited chain. */
function addStep(): void {
  chain.value.steps.push({ kind: "translation", arguments: [0, 0, 0] });
}

/**
 * Remove a step from the edited chain.
 * @param index Index of the step to remove.
 */
function removeStep(index: number): void {
  chain.value.steps.splice(index, 1);
}

/**
 * Move a step of the edited chain from one index to another.
 * @param fromIndex Index of the step to move.
 * @param toIndex Index to move it to.
 */
function reorderStep(fromIndex: number, toIndex: number): void {
  const steps = chain.value.steps;
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= steps.length ||
    toIndex >= steps.length
  ) {
    return;
  }
  const [step] = steps.splice(fromIndex, 1);
  steps.splice(toIndex, 0, step!);
}

/**
 * Resolve a `group:component` select value back to the input it names.
 * @param key Select value to resolve.
 */
function parseInputKey(key: string): TransformInputRef {
  const [group, component] = key.split(":");
  return {
    group: group as TransformInputGroup,
    component: Number(component) as TransformInputComponent
  };
}
</script>

<template>
  <div class="column q-gutter-y-md">
    <div class="text-body2">{{ t("preferences.chainLibrary") }}</div>
    <q-list bordered separator>
      <q-item
        v-for="listedChain of chains"
        :key="listedChain.id"
        v-ripple
        :active="listedChain.id === editedChainId"
        :aria-label="
          t('preferences.editChain', {
            name: chainLabel(listedChain)
          })
        "
        clickable
        @click="editedChainId = listedChain.id"
      >
        <q-item-section>{{ chainLabel(listedChain) }}</q-item-section>
        <q-item-section side>
          <q-icon
            v-if="listedChain.isBuiltIn"
            name="lock"
            :title="t('preferences.builtInChain')"
          />
          <q-btn
            v-else
            :aria-label="t('preferences.deleteChain')"
            flat
            icon="delete"
            round
            @click.stop="deleteChain(listedChain)"
          />
        </q-item-section>
      </q-item>
    </q-list>
    <q-btn
      color="primary"
      icon="content_copy"
      :label="t('preferences.addChain')"
      @click="addChain"
    />
    <q-separator />
    <div v-if="chain.isBuiltIn" class="text-weight-light">
      <i>{{ t("preferences.builtInChainHint") }}</i>
    </div>
    <CommittedInput
      v-else
      v-model="chainName"
      hide-bottom-space
      :label="t('preferences.chainName')"
      outlined
      :rules="nameRules"
    />
    <div class="text-body2">{{ t("preferences.chainSteps") }}</div>
    <div v-if="!chain.steps.length" class="text-weight-light">
      <i>{{ t("preferences.noSteps") }}</i>
    </div>
    <div
      v-for="(step, index) of chain.steps"
      :key="index"
      class="row items-start no-wrap q-gutter-x-sm step-row"
      :class="{
        'step-row--dragging': draggedIndex === index,
        'step-row--drop-target':
          dropTargetIndex === index && draggedIndex !== index
      }"
      @dragover="dragOverRow(index, $event)"
      @drop="dropRow(index)"
    >
      <div
        v-if="!chain.isBuiltIn"
        class="step-row__handle"
        draggable="true"
        :title="t('preferences.dragToReorder')"
        @dragend="endDrag"
        @dragstart.stop="startDrag(index, $event)"
      >
        <q-icon name="drag_indicator" size="sm" />
      </div>
      <TransformChainStepRow
        class="col"
        :input-options="inputOptions"
        :is-read-only="chain.isBuiltIn"
        :step="step"
      />
      <q-btn
        v-if="!chain.isBuiltIn"
        :aria-label="t('preferences.deleteStep')"
        dense
        flat
        icon="delete"
        round
        @click="removeStep(index)"
      />
    </div>
    <q-btn
      v-if="!chain.isBuiltIn"
      color="primary"
      icon="add"
      :label="t('preferences.addStep')"
      @click="addStep"
    />
    <q-select
      v-model="depthAxisKey"
      dense
      :disable="chain.isBuiltIn"
      emit-value
      :hint="t('preferences.depthAxisHint')"
      :label="t('preferences.depthAxis')"
      map-options
      :options="depthAxisOptions"
      outlined
    />
    <div class="text-caption">{{ unusedInputsCaption }}</div>
  </div>
</template>

<style lang="sass" scoped>
.step-row__handle
  cursor: grab
  display: flex
  padding-top: 0.75rem

.step-row--dragging
  opacity: 0.5

.step-row--drop-target
  outline: 2px solid var(--q-primary)
  outline-offset: -2px
</style>
