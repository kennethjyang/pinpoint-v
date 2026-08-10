<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { CoordinateSystemNode } from "@/features/coordinate-system";
import CoordinateSystemValueList from "./CoordinateSystemValueList.vue";

const { node, index } = defineProps<{
  node: CoordinateSystemNode;
  index: number;
}>();

const { t } = useI18n();
</script>

<template>
  <q-expansion-item
    default-opened
    header-class="text-weight-bold"
    icon="sym_o_transform"
    :label="t('coordinateSystemInspector.transform', { index: index + 1 })"
  >
    <div class="q-py-md">
      <div class="column no-wrap q-gutter-y-md">
        <q-toggle
          v-model="node.onSurface"
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
