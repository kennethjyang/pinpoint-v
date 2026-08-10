<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  CoordinateSystemNodeComponent,
  CoordinateSystemValue
} from "@/features/coordinate-system";
import CommittedInput from "@/components/CommittedInput.vue";
import { useCoordinateSystemValueModel } from "../composable/useCoordinateSystemValueModel";
import { useValidationRules } from "@/composable/useValidationRules";
import { usePreferencesStore } from "@/stores/preferences.store";

const { coordinateSystemValue, component, label, ariaLabel, disable } =
  defineProps<{
    coordinateSystemValue: CoordinateSystemValue;
    component: CoordinateSystemNodeComponent;
    label: string;
    ariaLabel: string;
    disable: boolean;
  }>();

const preferences = usePreferencesStore();
const { optionalNumber: numberRules } = useValidationRules();
const { t } = useI18n();
const { value, suffix, toDisplay } = useCoordinateSystemValueModel(
  () => coordinateSystemValue,
  component
);

const isOutOfBounds = computed(() => {
  const bounds = coordinateSystemValue.bounds;
  return (
    bounds !== null &&
    (coordinateSystemValue.value < bounds[0] ||
      coordinateSystemValue.value > bounds[1])
  );
});
const boundsMessage = computed(() => {
  const bounds = coordinateSystemValue.bounds;
  return bounds === null
    ? ""
    : t("probeInspector.outOfBounds", {
        minimum: formatBound(bounds[0]),
        maximum: formatBound(bounds[1]),
        unit: suffix.value
      });
});

/**
 * Format a stored bound in the value's display unit and precision.
 * @param storedValue Bound value in the stored unit.
 */
function formatBound(storedValue: number): string {
  return toDisplay(storedValue).toFixed(preferences.decimalPrecision);
}
</script>

<template>
  <CommittedInput
    v-model="value"
    :aria-label="ariaLabel"
    class="col"
    :disable="disable"
    :error="isOutOfBounds"
    :error-message="boundsMessage"
    hide-bottom-space
    :label="label"
    outlined
    :rules="numberRules"
    :suffix="suffix"
  />
</template>
