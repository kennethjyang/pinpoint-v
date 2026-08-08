<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  addCoordinateSystemTransform,
  type CoordinateSystem
} from "@/features/coordinate-system";
import { useValidationRules } from "@/composable/useValidationRules";
import CommittedInput from "@/components/CommittedInput.vue";

const { coordinateSystem } = defineProps<{
  coordinateSystem: CoordinateSystem;
}>();

const { requiredName: nameRules } = useValidationRules();
const { t } = useI18n();

const name = computed({
  get: () => coordinateSystem.name,
  set: (value: string) => (coordinateSystem.name = value.trim())
});
</script>

<template>
  <div class="column full-height coordinate-system-inspector">
    <CommittedInput
      v-model="name"
      hide-bottom-space
      :label="t('coordinateSystemInspector.name')"
      outlined
      :rules="nameRules"
    />
    <q-btn
      class="full-width"
      icon="add"
      :label="t('coordinateSystemInspector.addTransform')"
      @click="addCoordinateSystemTransform(coordinateSystem)"
    />
    <q-list bordered class="col scroll" separator></q-list>
  </div>
</template>

<style lang="sass" scoped>
// `gap`, not `q-gutter-y-md`: the gutter class spaces children with a negative
// margin on the parent, which cancels out when a child is itself a gutter
// container. Matches ProbeInspector's `&__section` spacing (see its style block
// for the `flex-wrap: nowrap` rationale).
.coordinate-system-inspector
  flex-wrap: nowrap
  gap: 16px
  padding: 8px 0
</style>
