<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ValidationRule } from "quasar";
import CommittedInput from "@/components/CommittedInput.vue";
import { useCoordinateSystemValueModel } from "../composable/useCoordinateSystemValueModel";
import { useNumericModel } from "@/composable/useNumericModel";
import { useValidationRules } from "@/composable/useValidationRules";
import { usePreferencesStore } from "@/stores/preferences.store";
import {
  type CoordinateSystemNodeComponent,
  type CoordinateSystemValue,
  setCoordinateSystemValueBounded,
  setCoordinateSystemValueFixed
} from "@/features/coordinate-system";

// One axis-mapping choice. `attrs` puts a stable aria-label on the rendered
// button (Quasar spreads it onto each `q-btn`).
interface AxisOption {
  label: string;
  value: number;
  attrs: { "aria-label": string };
}

// A value name is optional: `buildFixedCoordinateSystemValue()` deliberately
// builds unnamed values.
const VALUE_NAME_RULES: ValidationRule<string>[] = [];

const { coordinateSystemValue, component } = defineProps<{
  coordinateSystemValue: CoordinateSystemValue;
  component: CoordinateSystemNodeComponent;
}>();
const axisIndex = defineModel<number>("axisIndex", { required: true });

const preferences = usePreferencesStore();
const { optionalNumber: numberRules } = useValidationRules();
const { t } = useI18n();
const { value, suffix, toDisplay, fromDisplay } = useCoordinateSystemValueModel(
  () => coordinateSystemValue,
  component
);

const name = computed({
  get: () => coordinateSystemValue.name,
  set: (value: string) => (coordinateSystemValue.name = value.trim())
});
const minimumBound = useNumericModel(
  () => coordinateSystemValue.bounds?.[0] ?? 0,
  next => {
    if (coordinateSystemValue.bounds) coordinateSystemValue.bounds[0] = next;
  },
  toDisplay,
  fromDisplay,
  () => preferences.decimalPrecision
);
const maximumBound = useNumericModel(
  () => coordinateSystemValue.bounds?.[1] ?? 0,
  next => {
    if (coordinateSystemValue.bounds) coordinateSystemValue.bounds[1] = next;
  },
  toDisplay,
  fromDisplay,
  () => preferences.decimalPrecision
);
const isBounded = computed(() => coordinateSystemValue.bounds !== null);
const axisOptions = computed<AxisOption[]>(() => [
  {
    label: t("axis.x"),
    value: 0,
    attrs: {
      "aria-label": t("coordinateSystemInspector.mapToAxis", {
        axis: t("axis.x")
      })
    }
  },
  {
    label: t("axis.y"),
    value: 1,
    attrs: {
      "aria-label": t("coordinateSystemInspector.mapToAxis", {
        axis: t("axis.y")
      })
    }
  },
  {
    label: t("axis.z"),
    value: 2,
    attrs: {
      "aria-label": t("coordinateSystemInspector.mapToAxis", {
        axis: t("axis.z")
      })
    }
  }
]);
</script>

<template>
  <div>
    <div class="column no-wrap q-gutter-y-sm">
      <CommittedInput
        v-model="name"
        hide-bottom-space
        :label="t('coordinateSystemInspector.valueName')"
        outlined
        :rules="VALUE_NAME_RULES"
      />
      <q-btn-toggle
        v-model="axisIndex"
        :aria-label="
          t('coordinateSystemInspector.axis', {
            name: coordinateSystemValue.name
          })
        "
        :options="axisOptions"
        spread
        toggle-color="primary"
      />
      <CommittedInput
        v-model="value"
        hide-bottom-space
        :label="t('coordinateSystemInspector.value')"
        outlined
        :rules="numberRules"
        :suffix="suffix"
      />
      <div class="row q-gutter-x-sm">
        <q-toggle
          :label="t('coordinateSystemInspector.fixed')"
          :model-value="coordinateSystemValue.fixed"
          @update:model-value="
            setCoordinateSystemValueFixed(coordinateSystemValue, $event)
          "
        />
        <q-toggle
          :disable="coordinateSystemValue.fixed"
          :label="t('coordinateSystemInspector.bounded')"
          :model-value="isBounded"
          @update:model-value="
            setCoordinateSystemValueBounded(coordinateSystemValue, $event)
          "
        />
      </div>
      <div
        v-if="isBounded && !coordinateSystemValue.fixed"
        class="row q-gutter-x-sm"
      >
        <CommittedInput
          v-model="minimumBound"
          class="col"
          hide-bottom-space
          :label="t('coordinateSystemInspector.minimum')"
          outlined
          :rules="numberRules"
          :suffix="suffix"
        />
        <CommittedInput
          v-model="maximumBound"
          class="col"
          hide-bottom-space
          :label="t('coordinateSystemInspector.maximum')"
          outlined
          :rules="numberRules"
          :suffix="suffix"
        />
      </div>
    </div>
  </div>
</template>
