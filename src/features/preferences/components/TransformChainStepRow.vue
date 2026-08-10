<script lang="ts" setup>
import { computed, type WritableComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import CommittedInput from "@/components/CommittedInput.vue";
import { useNumericModel } from "@/composable/useNumericModel";
import { useUnitLabels } from "@/composable/useUnitLabels";
import { useValidationRules } from "@/composable/useValidationRules";
import type {
  TransformInputComponent,
  TransformInputGroup,
  TransformStep
} from "@/features/scene";
import { usePreferencesStore } from "@/stores/preferences.store";
import {
  millimetersToPositionUnit,
  positionUnitToMillimeters,
  radiansToRotationUnit,
  rotationUnitToRadians
} from "@/utils/math";

/** One entry of an input picker, as the chain editor builds them. */
interface TransformInputOption {
  label: string;
  value: string;
}

/** One argument slot: the slot it fills, plus its fixed-value model. */
interface ArgumentField {
  component: TransformInputComponent;
  model: WritableComputedRef<string>;
}

/**
 * Select value standing for a fixed argument rather than an input. Input
 * options are keyed `group:component`, matching the chain editor.
 */
const FIXED_ARGUMENT_KEY = "";

/** Every argument slot of a step, in order. */
const COMPONENTS: readonly TransformInputComponent[] = [0, 1, 2];

/** i18n key of each argument slot's axis, by step kind. */
const AXIS_KEYS = {
  translation: ["axisAp", "axisDv", "axisMl"],
  rotation: ["axisRoll", "axisYaw", "axisPitch"]
} as const;

const { step, inputOptions, isReadOnly } = defineProps<{
  step: TransformStep;
  inputOptions: TransformInputOption[];
  isReadOnly: boolean;
}>();

const { t } = useI18n();
const preferences = usePreferencesStore();
const unitLabels = useUnitLabels();
const { optionalNumber: numberRules } = useValidationRules();

const kindOptions = computed(() => [
  { label: t("preferences.stepTranslation"), value: "translation" },
  { label: t("preferences.stepRotation"), value: "rotation" }
]);

const argumentOptions = computed(() => [
  { label: t("preferences.fixedValue"), value: FIXED_ARGUMENT_KEY },
  ...inputOptions
]);

const valueSuffix = computed(() =>
  step.kind === "rotation"
    ? unitLabels.rotation(preferences.rotationUnit)
    : unitLabels.position(preferences.positionUnit)
);

/**
 * Display-unit models of each argument's fixed value, in millimeters for a
 * translation step and radians for a rotation step. Built up front: a writable
 * model cannot be created inside `v-for`.
 */
const argumentFields: ArgumentField[] = COMPONENTS.map(component => ({
  component,
  model: useNumericModel(
    () => {
      const argument = step.arguments[component];
      return typeof argument === "number" ? argument : 0;
    },
    value => {
      step.arguments[component] = value;
    },
    storedValue =>
      step.kind === "rotation"
        ? radiansToRotationUnit(storedValue, preferences.rotationUnit)
        : millimetersToPositionUnit(storedValue, preferences.positionUnit),
    displayValue =>
      step.kind === "rotation"
        ? rotationUnitToRadians(displayValue, preferences.rotationUnit)
        : positionUnitToMillimeters(displayValue, preferences.positionUnit),
    () => preferences.decimalPrecision
  )
}));

/**
 * Label of an argument slot, naming the axis the step's kind acts on.
 * @param component Argument slot to label.
 */
function argumentLabel(component: TransformInputComponent): string {
  return t("preferences.argumentSource", {
    axis: t(`preferences.${AXIS_KEYS[step.kind][component]}`)
  });
}

/**
 * Select value of an argument slot: the input it reads, or the fixed option.
 * @param component Argument slot to read.
 */
function argumentKey(component: TransformInputComponent): string {
  const argument = step.arguments[component];
  return typeof argument === "number"
    ? FIXED_ARGUMENT_KEY
    : `${argument.group}:${argument.component}`;
}

/**
 * Point an argument slot at an input, or at a fixed value of zero.
 * @param component Argument slot to write.
 * @param key Select value picked for the slot.
 */
function setArgument(component: TransformInputComponent, key: string): void {
  if (key === FIXED_ARGUMENT_KEY) {
    step.arguments[component] = 0;
    return;
  }

  const [group, argumentComponent] = key.split(":");
  step.arguments[component] = {
    group: group as TransformInputGroup,
    component: Number(argumentComponent) as TransformInputComponent
  };
}

/**
 * Does an argument slot hold a fixed value rather than an input reference.
 * @param component Argument slot to check.
 */
function isFixed(component: TransformInputComponent): boolean {
  return typeof step.arguments[component] === "number";
}
</script>

<template>
  <div class="column q-gutter-y-sm">
    <q-select
      v-model="step.kind"
      dense
      :disable="isReadOnly"
      emit-value
      :label="t('preferences.stepKind')"
      map-options
      :options="kindOptions"
      outlined
    />
    <div
      v-for="field of argumentFields"
      :key="field.component"
      class="row items-start q-gutter-x-sm"
    >
      <q-select
        class="col"
        dense
        :disable="isReadOnly"
        emit-value
        :label="argumentLabel(field.component)"
        map-options
        :model-value="argumentKey(field.component)"
        :options="argumentOptions"
        outlined
        @update:model-value="key => setArgument(field.component, key)"
      />
      <CommittedInput
        v-if="isFixed(field.component)"
        v-model="field.model.value"
        class="col-4"
        dense
        :disable="isReadOnly"
        hide-bottom-space
        :label="t('preferences.fixedValue')"
        outlined
        :rules="numberRules"
        :suffix="valueSuffix"
      />
    </div>
  </div>
</template>
