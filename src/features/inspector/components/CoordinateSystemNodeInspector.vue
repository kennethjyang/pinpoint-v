<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type {
  CoordinateSystemNode,
  CoordinateSystemNodeComponent
} from "@/features/coordinate-system";
import { getCoordinateSystemSlots } from "@/features/coordinate-system";
import CommittedInput from "@/components/CommittedInput.vue";
import {
  type CoordinateSystemUnitModel,
  useCoordinateSystemUnits
} from "../composable/useCoordinateSystemValueModel";
import { useValidationRules } from "@/composable/useValidationRules";
import { usePreferencesStore } from "@/stores/preferences.store";
import CoordinateSystemValueDialog from "./CoordinateSystemValueDialog.vue";

const AXIS_MESSAGE_KEYS = ["axis.x", "axis.y", "axis.z"] as const;

const { node } = defineProps<{
  node: CoordinateSystemNode;
}>();

const emit = defineEmits<{
  "update:onSurface": [onSurface: boolean];
  focus: [];
  delete: [];
  dragStart: [event: DragEvent];
  dragEnd: [];
}>();

const { requiredName: nodeNameRules } = useValidationRules();
const { t } = useI18n();
const preferences = usePreferencesStore();
const positionUnits = useCoordinateSystemUnits("position");
const rotationUnits = useCoordinateSystemUnits("rotation");

const isPositionDialogOpen = ref(false);
const isRotationDialogOpen = ref(false);

const name = computed({
  get: () => node.name,
  set: (value: string) => (node.name = value.trim())
});

const isOnSurface = computed({
  get: () => node.onSurface,
  set: (value: boolean) => emit("update:onSurface", value)
});

const positionSummary = computed(() =>
  valueSummary(
    "position",
    positionUnits,
    t("coordinateSystemInspector.position")
  )
);
const rotationSummary = computed(() =>
  valueSummary(
    "rotation",
    rotationUnits,
    t("coordinateSystemInspector.rotation")
  )
);

/**
 * Summary line for one of a node's triples, listing only the values the user can change.
 * @param component Whether to summarize the position or rotation triple.
 * @param units Display-unit converters for that component.
 * @param label Localized name of the component.
 */
function valueSummary(
  component: CoordinateSystemNodeComponent,
  units: CoordinateSystemUnitModel,
  label: string
): string {
  // Fixed values are rigid constants the user never edits, so they are left out
  // entirely, matching `ProbeTransformValueRow`'s adjustable-slot filter.
  const entries = getCoordinateSystemSlots(node, component)
    .filter(({ value }) => value.mode !== "fixed")
    .map(({ axis, value }) =>
      t("coordinateSystemInspector.valueSummaryEntry", {
        name: value.name || t(AXIS_MESSAGE_KEYS[axis]),
        value: units
          .toDisplay(value.value)
          .toFixed(preferences.decimalPrecision)
      })
    );
  return t("coordinateSystemInspector.valueSummary", {
    label,
    values: entries.length
      ? entries.join(", ")
      : t("coordinateSystemInspector.valueSummaryAllFixed")
  });
}
</script>

<template>
  <q-expansion-item default-opened header-class="text-weight-bold">
    <template #header>
      <q-item-section side>
        <div
          class="node-row__handle"
          draggable="true"
          :title="t('coordinateSystemInspector.dragToReorder')"
          @click.stop
          @dragend="emit('dragEnd')"
          @dragstart.stop="emit('dragStart', $event)"
        >
          <q-icon name="drag_indicator" size="sm" />
        </div>
      </q-item-section>
      <q-item-section avatar>
        <q-icon name="sym_o_transform" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ node.name }}</q-item-label>
      </q-item-section>
    </template>
    <div class="q-py-md" @click="emit('focus')" @focusin="emit('focus')">
      <div class="column no-wrap q-gutter-y-md">
        <CommittedInput
          v-model="name"
          hide-bottom-space
          :label="t('coordinateSystemInspector.nodeName')"
          outlined
          :rules="nodeNameRules"
        />
        <q-toggle
          v-model="isOnSurface"
          :label="t('coordinateSystemInspector.surfaceCoordinate')"
        />
        <q-btn
          align="left"
          class="full-width"
          :label="positionSummary"
          no-caps
          outline
          @click="isPositionDialogOpen = true"
        />
        <q-btn
          align="left"
          class="full-width"
          :label="rotationSummary"
          no-caps
          outline
          @click="isRotationDialogOpen = true"
        />
        <CoordinateSystemValueDialog
          v-model="isPositionDialogOpen"
          component="position"
          :label="t('coordinateSystemInspector.position')"
          :node="node"
        />
        <CoordinateSystemValueDialog
          v-model="isRotationDialogOpen"
          component="rotation"
          :label="t('coordinateSystemInspector.rotation')"
          :node="node"
        />
        <q-btn
          class="full-width"
          color="negative"
          icon="delete"
          :label="t('coordinateSystemInspector.deleteTransform')"
          @click.stop="emit('delete')"
        />
      </div>
    </div>
  </q-expansion-item>
</template>

<style lang="sass" scoped>
.node-row__handle
  cursor: grab
  display: flex
</style>
