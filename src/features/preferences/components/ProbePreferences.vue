<script lang="ts" setup>
import { computed, toRef } from "vue";
import { usePreferencesStore } from "@/stores/preferences.store";
import { useUnitLabels } from "@/composable/useUnitLabels";
import {
  millimetersToPositionUnit,
  positionUnitToMillimeters
} from "@/utils/math";
import { useClampedNumberModel } from "../composable/useClampedNumberModel";

const preferences = usePreferencesStore();
const unitLabels = useUnitLabels();

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

const defaultZoomExponent = computed<number>({
  get: () => Math.log2(preferences.sliceDefaultZoomFraction),
  set: (value: number) => {
    preferences.sliceDefaultZoomFraction = 2 ** value;
  }
});

/**
 * Format a default-zoom slider tick as a fraction label, e.g. -3 to "1/8".
 * @param exponent Slider position, as a log2 fraction exponent.
 */
function defaultZoomFractionLabel(exponent: number): string {
  const denominator = 2 ** -exponent;
  return denominator === 1 ? "1" : `1/${denominator}`;
}
</script>

<template>
  <div class="column q-gutter-y-md">
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
    </div>
    <q-separator />
    <div>
      <div class="text-h6">{{ $t("preferences.sliceView") }}</div>
      <div class="text-caption q-mt-xs q-mb-sm">
        {{ $t("preferences.defaultZoomFractionHint") }}
      </div>
      <q-slider
        v-model="defaultZoomExponent"
        :aria-label="$t('preferences.defaultZoomFraction')"
        :min="-3"
        :max="0"
        :step="1"
        :markers="1"
        :marker-labels="defaultZoomFractionLabel"
        :label-value="defaultZoomFractionLabel(defaultZoomExponent)"
        label
        class="q-px-lg"
      />
    </div>
  </div>
</template>
