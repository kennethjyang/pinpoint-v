<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { CoordinateSystemNode } from "@/features/coordinate-system";
import ProbeTransformValueRow from "./ProbeTransformValueRow.vue";

const { chain, disable } = defineProps<{
  chain: CoordinateSystemNode[];
  disable: boolean;
}>();

const { t } = useI18n();

const visibleNodes = computed(() =>
  chain
    .map((node, index) => ({ node, index }))
    .filter(
      ({ node }) =>
        node.position.some(({ fixed }) => !fixed) ||
        node.rotation.some(({ fixed }) => !fixed)
    )
);
</script>

<template>
  <q-list separator>
    <q-item v-for="{ node, index } of visibleNodes" :key="index">
      <q-item-section>
        <div class="column no-wrap q-gutter-y-sm">
          <div class="text-overline">{{
            t("probeInspector.transform", { index: index + 1 })
          }}</div>
          <ProbeTransformValueRow
            component="position"
            :disable="disable"
            :label="t('probeInspector.position')"
            :node="node"
            :node-index="index"
          />
          <ProbeTransformValueRow
            component="rotation"
            :disable="disable"
            :label="t('probeInspector.rotation')"
            :node="node"
            :node-index="index"
          />
        </div>
      </q-item-section>
    </q-item>
  </q-list>
</template>
