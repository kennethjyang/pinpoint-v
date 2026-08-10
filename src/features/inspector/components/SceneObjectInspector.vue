<script lang="ts" setup>
import { computed, type WritableComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import {
  findTransformChain,
  getTransformChainLabel,
  getTransformChains,
  isTransformInputBound,
  STANDARD_COLORS,
  type SceneObject,
  toggleSceneObjectCollidable,
  toggleSceneObjectLock,
  TRANSFORM_INPUT_GROUPS,
  type TransformInputComponent,
  type TransformInputGroup,
  type TransformStepKind
} from "@/features/scene";
import { usePreferencesStore } from "@/stores/preferences.store";
import { useNumericTupleModel } from "@/composable/useNumericTupleModel";
import { useUnitLabels } from "@/composable/useUnitLabels";
import { useValidationRules } from "@/composable/useValidationRules";
import CommittedInput from "@/components/CommittedInput.vue";
import {
  millimetersToPositionUnit,
  positionUnitToMillimeters,
  radiansToRotationUnit,
  rotationUnitToRadians
} from "@/utils/math";

/** Unit kind of each transform input group's three values. */
const TRANSFORM_INPUT_GROUP_KINDS: Readonly<
  Record<TransformInputGroup, TransformStepKind>
> = {
  globalTranslation: "translation",
  globalRotation: "rotation",
  localRotation: "rotation",
  localTranslation: "translation"
};

/** Every component slot of an input group, in the order its row lists them. */
const TRANSFORM_INPUT_COMPONENTS: readonly TransformInputComponent[] = [
  0, 1, 2
];

/** One transform input's writable display model, paired with the slot it edits. */
interface TransformInputField {
  component: TransformInputComponent;
  model: WritableComputedRef<string>;
}

/** One row of transform inputs: an input group's three fields. */
interface TransformInputRow {
  group: TransformInputGroup;
  kind: TransformStepKind;
  fields: TransformInputField[];
}

const { sceneObject } = defineProps<{
  sceneObject: SceneObject;
}>();

const preferences = usePreferencesStore();
const unitLabels = useUnitLabels();
const {
  requiredName: nameRules,
  optionalNumber: numberRules,
  positiveNumber: scaleRules
} = useValidationRules();
const { t } = useI18n();

const positionSuffix = computed(() =>
  unitLabels.position(preferences.positionUnit)
);

const rotationSuffix = computed(() =>
  unitLabels.rotation(preferences.rotationUnit)
);

const name = computed({
  get: () => sceneObject.name,
  set: (value: string) => (sceneObject.name = value.trim())
});

/** Every transform chain the object can be posed through. */
const chains = computed(() => getTransformChains(preferences.transformChains));

/** Chain mapping this object's twelve transform inputs onto its pose. */
const chain = computed(() =>
  findTransformChain(chains.value, sceneObject.transformChainId)
);

const chainOptions = computed(() =>
  chains.value.map(candidate => ({
    label: getTransformChainLabel(candidate, key => t(key)),
    value: candidate.id
  }))
);

/**
 * Writable display models for the object's twelve transform inputs, one row per
 * input group. Built up front: a composable cannot be created inside `v-for`.
 */
const transformInputRows: TransformInputRow[] = TRANSFORM_INPUT_GROUPS.map(
  group => ({
    group,
    kind: TRANSFORM_INPUT_GROUP_KINDS[group],
    fields: TRANSFORM_INPUT_COMPONENTS.map(component => ({
      component,
      model:
        TRANSFORM_INPUT_GROUP_KINDS[group] === "rotation"
          ? useNumericTupleModel(
              () => sceneObject.transformInputs[group],
              component,
              radians =>
                radiansToRotationUnit(radians, preferences.rotationUnit),
              value => rotationUnitToRadians(value, preferences.rotationUnit),
              () => preferences.decimalPrecision
            )
          : useNumericTupleModel(
              () => sceneObject.transformInputs[group],
              component,
              millimeters =>
                millimetersToPositionUnit(
                  millimeters,
                  preferences.positionUnit
                ),
              value =>
                positionUnitToMillimeters(value, preferences.positionUnit),
              () => preferences.decimalPrecision
            )
    }))
  })
);

const scaleAp = useNumericTupleModel(
  () => sceneObject.scale,
  0,
  value => value,
  value => value,
  () => preferences.decimalPrecision
);
const scaleDv = useNumericTupleModel(
  () => sceneObject.scale,
  1,
  value => value,
  value => value,
  () => preferences.decimalPrecision
);
const scaleMl = useNumericTupleModel(
  () => sceneObject.scale,
  2,
  value => value,
  value => value,
  () => preferences.decimalPrecision
);

const lockIcon = computed(() =>
  sceneObject.lock ? "lock" : "sym_o_lock_open_right"
);
const lockColor = computed(() => (sceneObject.lock ? "accent" : undefined));
const lockLabel = computed(() =>
  sceneObject.lock
    ? t("sceneObjectInspector.unlock")
    : t("sceneObjectInspector.lock")
);
</script>

<template>
  <div class="column q-gutter-y-md">
    <q-btn
      :aria-label="lockLabel"
      class="full-width"
      :color="lockColor"
      :icon="lockIcon"
      :label="lockLabel"
      @click="toggleSceneObjectLock(sceneObject)"
    >
      <q-tooltip>{{ lockLabel }}</q-tooltip>
    </q-btn>

    <q-toggle
      :label="t('sceneObjectInspector.collisionDetection')"
      :model-value="sceneObject.collidable"
      @update:model-value="toggleSceneObjectCollidable(sceneObject)"
    />

    <CommittedInput
      v-model="name"
      :label="t('sceneObjectInspector.name')"
      hide-bottom-space
      outlined
      :rules="nameRules"
    />

    <q-select
      v-model="sceneObject.transformChainId"
      :disable="sceneObject.lock"
      emit-value
      :label="t('sceneObjectInspector.transformChain')"
      map-options
      :options="chainOptions"
      outlined
    />

    <div v-for="row in transformInputRows" :key="row.group">
      <div class="text-body2 q-pb-xs">{{
        t(`transformChain.${row.group}`)
      }}</div>
      <div class="row q-gutter-x-sm">
        <CommittedInput
          v-for="field in row.fields"
          :key="field.component"
          v-model="field.model.value"
          :disable="
            sceneObject.lock ||
            !isTransformInputBound(chain, {
              group: row.group,
              component: field.component
            })
          "
          :label="preferences.transformInputNames[row.group][field.component]"
          :rules="numberRules"
          :suffix="row.kind === 'rotation' ? rotationSuffix : positionSuffix"
          class="col"
          hide-bottom-space
          outlined
        />
      </div>
    </div>

    <div class="row q-gutter-x-sm">
      <CommittedInput
        v-model="scaleAp"
        :disable="sceneObject.lock"
        :label="t('axis.ap')"
        :rules="scaleRules"
        :suffix="t('sceneObjectInspector.scaleSuffix')"
        class="col"
        hide-bottom-space
        outlined
      />
      <CommittedInput
        v-model="scaleDv"
        :disable="sceneObject.lock"
        :label="t('axis.dv')"
        :rules="scaleRules"
        :suffix="t('sceneObjectInspector.scaleSuffix')"
        class="col"
        hide-bottom-space
        outlined
      />
      <CommittedInput
        v-model="scaleMl"
        :disable="sceneObject.lock"
        :label="t('axis.ml')"
        :rules="scaleRules"
        :suffix="t('sceneObjectInspector.scaleSuffix')"
        class="col"
        hide-bottom-space
        outlined
      />
    </div>

    <div>
      <q-color
        v-model="sceneObject.color"
        :palette="STANDARD_COLORS"
        default-view="palette"
      />
    </div>
  </div>
</template>
