<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { CoordinateSystemNode } from "@/features/coordinate-system";
import CommittedInput from "@/components/CommittedInput.vue";
import { useValidationRules } from "@/composable/useValidationRules";
import CoordinateSystemValueList from "./CoordinateSystemValueList.vue";

const { node } = defineProps<{
  node: CoordinateSystemNode;
}>();

const emit = defineEmits<{ "update:onSurface": [onSurface: boolean] }>();

const { requiredName: nodeNameRules } = useValidationRules();
const { t } = useI18n();

const name = computed({
  get: () => node.name,
  set: (value: string) => (node.name = value.trim())
});

const isOnSurface = computed({
  get: () => node.onSurface,
  set: (value: boolean) => emit("update:onSurface", value)
});
</script>

<template>
  <q-expansion-item
    default-opened
    header-class="text-weight-bold"
    icon="sym_o_transform"
    :label="node.name"
  >
    <div class="q-py-md">
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
        <CoordinateSystemValueList
          component="position"
          :label="t('coordinateSystemInspector.position')"
          :node="node"
        />
        <CoordinateSystemValueList
          component="rotation"
          :label="t('coordinateSystemInspector.rotation')"
          :node="node"
        />
      </div>
    </div>
  </q-expansion-item>
</template>
