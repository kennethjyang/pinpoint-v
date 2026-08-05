<script lang="ts" setup>
import { toRef } from "vue";
import { usePreferencesStore } from "@/stores/preferences.store";
import { useClampedNumberModel } from "../composable/useClampedNumberModel";

const preferences = usePreferencesStore();

const shankThickness = useClampedNumberModel(
  toRef(preferences, "probeShankThicknessMillimeters"),
  0.001,
  100
);
const headStageLength = useClampedNumberModel(
  toRef(preferences, "probeHeadStageLengthMillimeters"),
  0.01,
  1000
);
const headStageCutDepth = useClampedNumberModel(
  toRef(preferences, "probeHeadStageCutDepthMillimeters"),
  0,
  1000
);
const rodDiameter = useClampedNumberModel(
  toRef(preferences, "probeRodDiameterMillimeters"),
  0.01,
  1000
);
const rodLength = useClampedNumberModel(
  toRef(preferences, "probeRodLengthMillimeters"),
  0.01,
  10_000
);
</script>

<template>
  <div>
    <div class="text-h6">{{ $t("preferences.probeShape") }}</div>
    <div class="column q-gutter-y-md">
      <q-input
        v-model="shankThickness"
        :label="$t('preferences.shankThickness')"
        :suffix="$t('units.millimeter')"
        dense
        outlined
        step="any"
        type="number"
      />
      <q-input
        v-model="headStageLength"
        :label="$t('preferences.headStageLength')"
        :suffix="$t('units.millimeter')"
        dense
        outlined
        step="any"
        type="number"
      />
      <q-input
        v-model="headStageCutDepth"
        :label="$t('preferences.headStageCutDepth')"
        :suffix="$t('units.millimeter')"
        dense
        outlined
        step="any"
        type="number"
      />
      <q-input
        v-model="rodDiameter"
        :label="$t('preferences.rodDiameter')"
        :suffix="$t('units.millimeter')"
        dense
        outlined
        step="any"
        type="number"
      />
      <q-input
        v-model="rodLength"
        :label="$t('preferences.rodLength')"
        :suffix="$t('units.millimeter')"
        dense
        outlined
        step="any"
        type="number"
      />
    </div>
  </div>
</template>
