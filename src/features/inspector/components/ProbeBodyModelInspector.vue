<script lang="ts" setup>
import { computed, type WritableComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import {
  findTransformChain,
  getTransformChainLabel,
  getTransformChains,
  isTransformInputBound,
  type SceneModel,
  TRANSFORM_INPUT_GROUPS,
  type TransformInputComponent,
  type TransformInputGroup,
  type TransformStepKind
} from "@/features/scene";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
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

const {
  probeId,
  bodyModel,
  disable = false
} = defineProps<{
  probeId: string;
  bodyModel: SceneModel;
  disable?: boolean;
}>();

const currentExperiment = useCurrentExperimentStore();
const preferences = usePreferencesStore();
const unitLabels = useUnitLabels();
const { optionalNumber: numberRules, positiveNumber: scaleRules } =
  useValidationRules();
const { t } = useI18n();

const positionSuffix = computed(() =>
  unitLabels.position(preferences.positionUnit)
);

const rotationSuffix = computed(() =>
  unitLabels.rotation(preferences.rotationUnit)
);

const isGizmoAttached = computed(
  () => currentExperiment.bodyModelGizmoProbeId === probeId
);

const gizmoButtonLabel = computed(() =>
  isGizmoAttached.value
    ? t("probeInspector.detachBodyModelGizmo")
    : t("probeInspector.attachBodyModelGizmo")
);

/** Every transform chain the body model can be posed through. */
const chains = computed(() => getTransformChains(preferences.transformChains));

/** Chain mapping this body model's twelve transform inputs onto its pose. */
const chain = computed(() =>
  findTransformChain(chains.value, bodyModel.transformChainId)
);

const chainOptions = computed(() =>
  chains.value.map(candidate => ({
    label: getTransformChainLabel(candidate, key => t(key)),
    value: candidate.id
  }))
);

/**
 * Writable display models for the body model's twelve transform inputs, one row
 * per input group. Built up front: a composable cannot be created inside
 * `v-for`.
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
              () => bodyModel.transformInputs[group],
              component,
              radians =>
                radiansToRotationUnit(radians, preferences.rotationUnit),
              value => rotationUnitToRadians(value, preferences.rotationUnit),
              () => preferences.decimalPrecision
            )
          : useNumericTupleModel(
              () => bodyModel.transformInputs[group],
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

const scaleX = useNumericTupleModel(
  () => bodyModel.scale,
  0,
  value => value,
  value => value,
  () => preferences.decimalPrecision
);
const scaleY = useNumericTupleModel(
  () => bodyModel.scale,
  1,
  value => value,
  value => value,
  () => preferences.decimalPrecision
);
const scaleZ = useNumericTupleModel(
  () => bodyModel.scale,
  2,
  value => value,
  value => value,
  () => preferences.decimalPrecision
);

/** Attach the transform gizmo to this probe's body model, or detach it again. */
function toggleGizmo() {
  currentExperiment.bodyModelGizmoProbeId = isGizmoAttached.value
    ? null
    : probeId;
}
</script>

<template>
  <!-- Plain wrapper: the parent inspector section is itself a `q-gutter-y-md`
       container, and its `> *` rule would override this column's negative top
       margin, doubling the gap above the first row. -->
  <div>
    <div class="column no-wrap q-gutter-y-md">
      <q-btn
        :aria-label="gizmoButtonLabel"
        :color="isGizmoAttached ? 'primary' : undefined"
        :disable="disable"
        icon="sym_o_drag_pan"
        :label="gizmoButtonLabel"
        @click="toggleGizmo"
      />

      <q-select
        v-model="bodyModel.transformChainId"
        :disable="disable"
        emit-value
        :label="t('probeInspector.bodyModelTransformChain')"
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
            class="col"
            :disable="
              disable ||
              !isTransformInputBound(chain, {
                group: row.group,
                component: field.component
              })
            "
            hide-bottom-space
            :label="preferences.transformInputNames[row.group][field.component]"
            outlined
            :rules="numberRules"
            :suffix="row.kind === 'rotation' ? rotationSuffix : positionSuffix"
          />
        </div>
      </div>

      <div class="row q-gutter-x-sm">
        <CommittedInput
          v-model="scaleX"
          class="col"
          :disable="disable"
          hide-bottom-space
          :label="t('probeInspector.bodyModelScale', { axis: t('axis.x') })"
          outlined
          :rules="scaleRules"
          :suffix="t('probeInspector.scaleSuffix')"
        />
        <CommittedInput
          v-model="scaleY"
          class="col"
          :disable="disable"
          hide-bottom-space
          :label="t('probeInspector.bodyModelScale', { axis: t('axis.y') })"
          outlined
          :rules="scaleRules"
          :suffix="t('probeInspector.scaleSuffix')"
        />
        <CommittedInput
          v-model="scaleZ"
          class="col"
          :disable="disable"
          hide-bottom-space
          :label="t('probeInspector.bodyModelScale', { axis: t('axis.z') })"
          outlined
          :rules="scaleRules"
          :suffix="t('probeInspector.scaleSuffix')"
        />
      </div>
    </div>
  </div>
</template>
