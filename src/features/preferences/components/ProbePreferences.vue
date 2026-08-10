<script lang="ts" setup>
import { computed, toRef, type WritableComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import TransformChainEditor from "./TransformChainEditor.vue";
import CommittedInput from "@/components/CommittedInput.vue";
import { useUnitLabels } from "@/composable/useUnitLabels";
import { useValidationRules } from "@/composable/useValidationRules";
import {
  getTransformChainLabel,
  getTransformChains,
  TRANSFORM_INPUT_GROUPS,
  type TransformInputComponent,
  type TransformInputGroup
} from "@/features/scene";
import { usePreferencesStore } from "@/stores/preferences.store";
import {
  millimetersToPositionUnit,
  positionUnitToMillimeters
} from "@/utils/math";
import { useClampedNumberModel } from "../composable/useClampedNumberModel";

/** One input name field: the slot it names, plus its trimming model. */
interface InputNameField {
  component: TransformInputComponent;
  model: WritableComputedRef<string>;
}

/** One row of name fields: an input group's three names. */
interface InputNameRow {
  group: TransformInputGroup;
  fields: InputNameField[];
}

/** Every component of an input group, in order. */
const COMPONENTS: readonly TransformInputComponent[] = [0, 1, 2];

/** i18n key of each component's axis, by whether the group rotates. */
const AXIS_KEYS = {
  translation: ["axisAp", "axisDv", "axisMl"],
  rotation: ["axisRoll", "axisYaw", "axisPitch"]
} as const;

const { t } = useI18n();
const preferences = usePreferencesStore();
const unitLabels = useUnitLabels();
const { requiredName: nameRules } = useValidationRules();

const positionSuffix = computed(() =>
  unitLabels.position(preferences.positionUnit)
);

const shankThickness = useClampedNumberModel(
  toRef(preferences, "probeShankThicknessMillimeters"),
  0.001,
  100,
  millimeters =>
    millimetersToPositionUnit(millimeters, preferences.positionUnit),
  value => positionUnitToMillimeters(value, preferences.positionUnit)
);
const headStageLength = useClampedNumberModel(
  toRef(preferences, "probeHeadStageLengthMillimeters"),
  0.01,
  1000,
  millimeters =>
    millimetersToPositionUnit(millimeters, preferences.positionUnit),
  value => positionUnitToMillimeters(value, preferences.positionUnit)
);
const headStageCutDepth = useClampedNumberModel(
  toRef(preferences, "probeHeadStageCutDepthMillimeters"),
  0,
  1000,
  millimeters =>
    millimetersToPositionUnit(millimeters, preferences.positionUnit),
  value => positionUnitToMillimeters(value, preferences.positionUnit)
);
const rodDiameter = useClampedNumberModel(
  toRef(preferences, "probeRodDiameterMillimeters"),
  0.01,
  1000,
  millimeters =>
    millimetersToPositionUnit(millimeters, preferences.positionUnit),
  value => positionUnitToMillimeters(value, preferences.positionUnit)
);
const rodLength = useClampedNumberModel(
  toRef(preferences, "probeRodLengthMillimeters"),
  0.01,
  10_000,
  millimeters =>
    millimetersToPositionUnit(millimeters, preferences.positionUnit),
  value => positionUnitToMillimeters(value, preferences.positionUnit)
);

/**
 * Trimming models for the twelve input names, one row per input group. Built
 * up front: a writable model cannot be created inside `v-for`.
 */
const transformInputRows: InputNameRow[] = TRANSFORM_INPUT_GROUPS.map(
  group => ({
    group,
    fields: COMPONENTS.map(component => ({
      component,
      model: computed({
        get: () => preferences.transformInputNames[group][component],
        set: (value: string) => {
          preferences.transformInputNames[group][component] = value.trim();
        }
      })
    }))
  })
);

const chainOptions = computed(() =>
  getTransformChains(preferences.transformChains).map(chain => ({
    label: getTransformChainLabel(chain, key => t(key)),
    value: chain.id
  }))
);

/**
 * Label of an input's name field, naming the axis the input acts on.
 * @param group Group the input belongs to.
 * @param component Component of the group.
 */
function axisLabel(
  group: TransformInputGroup,
  component: TransformInputComponent
): string {
  const kind =
    group === "globalRotation" || group === "localRotation"
      ? "rotation"
      : "translation";
  return t(`preferences.${AXIS_KEYS[kind][component]}`);
}
</script>

<template>
  <div>
    <div class="text-h6">{{ $t("preferences.probeShape") }}</div>
    <div class="column q-gutter-y-md">
      <q-input
        v-model="shankThickness"
        :label="$t('preferences.shankThickness')"
        :min="0.001"
        :suffix="positionSuffix"
        dense
        outlined
      />
      <q-input
        v-model="headStageLength"
        :label="$t('preferences.headStageLength')"
        :min="0.01"
        :suffix="positionSuffix"
        dense
        outlined
      />
      <q-input
        v-model="headStageCutDepth"
        :label="$t('preferences.headStageCutDepth')"
        :min="0"
        :suffix="positionSuffix"
        dense
        outlined
      />
      <q-input
        v-model="rodDiameter"
        :label="$t('preferences.rodDiameter')"
        :min="0.01"
        :suffix="positionSuffix"
        dense
        outlined
      />
      <q-input
        v-model="rodLength"
        :label="$t('preferences.rodLength')"
        :min="0.01"
        :suffix="positionSuffix"
        dense
        outlined
      />
    </div>
    <q-separator class="q-my-md" />
    <div class="text-h6">{{ $t("preferences.transformInputNamesTitle") }}</div>
    <div class="text-caption q-pb-sm">{{
      $t("preferences.transformInputNamesHint")
    }}</div>
    <div class="column q-gutter-y-md">
      <div v-for="row of transformInputRows" :key="row.group">
        <div class="text-body2 q-pb-xs">{{
          $t(`transformChain.${row.group}`)
        }}</div>
        <div class="row q-gutter-x-sm">
          <CommittedInput
            v-for="field of row.fields"
            :key="field.component"
            v-model="field.model.value"
            :aria-label="
              $t('preferences.transformInputNameLabel', {
                group: $t(`transformChain.${row.group}`),
                axis: axisLabel(row.group, field.component)
              })
            "
            class="col"
            dense
            hide-bottom-space
            :label="axisLabel(row.group, field.component)"
            outlined
            :rules="nameRules"
          />
        </div>
      </div>
    </div>
    <q-separator class="q-my-md" />
    <div class="text-h6">{{ $t("preferences.transformChainsTitle") }}</div>
    <div class="column q-gutter-y-md">
      <q-select
        v-model="preferences.defaultProbeChainId"
        dense
        emit-value
        :hint="$t('preferences.defaultProbeChainHint')"
        :label="$t('preferences.defaultProbeChain')"
        map-options
        :options="chainOptions"
        outlined
      />
      <TransformChainEditor />
    </div>
  </div>
</template>
