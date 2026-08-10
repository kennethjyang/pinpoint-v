<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  type CoordinateSystemNode,
  type CoordinateSystemNodeComponent,
  type CoordinateSystemValue,
  getCoordinateSystemValueAxis
} from "@/features/coordinate-system";
import ProbeTransformValueInput from "./ProbeTransformValueInput.vue";

const AXIS_MESSAGE_KEYS = ["axis.x", "axis.y", "axis.z"] as const;

const { node, nodeIndex, component, label, disable } = defineProps<{
  node: CoordinateSystemNode;
  nodeIndex: number;
  component: CoordinateSystemNodeComponent;
  label: string;
  disable: boolean;
}>();

const { t } = useI18n();

const values = computed(() =>
  component === "position" ? node.position : node.rotation
);
const isAllFixed = computed(() => values.value.every(({ fixed }) => fixed));

/**
 * Label a node value by its own name, or by its mapped axis letter when unnamed.
 * @param coordinateSystemValue Value to label.
 * @param valueIndex Index of the value within its position/rotation triple.
 */
function valueLabel(
  coordinateSystemValue: CoordinateSystemValue,
  valueIndex: number
): string {
  if (coordinateSystemValue.name) return coordinateSystemValue.name;
  const axisIndex = getCoordinateSystemValueAxis(node, component, valueIndex);
  return t(AXIS_MESSAGE_KEYS[axisIndex] ?? "axis.x");
}
</script>

<template>
  <div v-if="!isAllFixed">
    <div class="text-body2 q-pb-xs">{{ label }}</div>
    <div class="row q-gutter-x-sm">
      <ProbeTransformValueInput
        v-for="(coordinateSystemValue, valueIndex) of values"
        :key="valueIndex"
        :ariaLabel="
          t('probeInspector.transformValue', {
            index: nodeIndex + 1,
            name: valueLabel(coordinateSystemValue, valueIndex)
          })
        "
        :component="component"
        :coordinate-system-value="coordinateSystemValue"
        :disable="disable || coordinateSystemValue.fixed"
        :label="valueLabel(coordinateSystemValue, valueIndex)"
      />
    </div>
  </div>
</template>
