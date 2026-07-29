<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { type ValidationRule } from "quasar";
import { getProbeIdentifier, Probe } from "@/features/probe";
import { STANDARD_COLORS } from "@/features/scene";
import { useProbeLibraryStore } from "@/stores/probe-library.store";
import {
  internProbeInterfaceProbe,
  isProbeNameAvailable,
  removeInternProbeInterfaceProbe
} from "@/features/experiment";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import CommittedInput from "./CommittedInput.vue";

const { probe } = defineProps<{
  probe: Probe;
}>();

const probeLibraryStore = useProbeLibraryStore();
const currentExperimentStore = useCurrentExperimentStore();

const { t } = useI18n();

/**
 * Link to the probe identifier that also checks to remove interned interfaces after switching.
 */
const probeIdentifier = computed({
  get: () => probe.probeIdentifier,
  set: (value: string) => {
    // Remember old identifier for removal.
    const oldIdentifier = probeIdentifier.value;

    // Get the new probe interface definition and intern it. Exit if not found.
    const newProbeInterfaceProbe = probeLibraryStore.library.find(
      probeInterfaceProbe => getProbeIdentifier(probeInterfaceProbe) === value
    );
    if (!newProbeInterfaceProbe) return;
    internProbeInterfaceProbe(
      currentExperimentStore.experiment,
      newProbeInterfaceProbe
    );

    // Set the new value.
    probe.probeIdentifier = value;

    // Ensure the old one is removed.
    removeInternProbeInterfaceProbe(
      currentExperimentStore.experiment,
      oldIdentifier
    );
  }
});

const probeIdentifiers = computed<string[]>(() =>
  probeLibraryStore.library.map(getProbeIdentifier)
);

const name = computed({
  get: () => probe.name,
  set: (value: string) => (probe.name = value.trim())
});

const ap = computed({
  get: () => String(probe.tipPosition[0]),
  set: (value: string) => (probe.tipPosition[0] = Number(value))
});

const dv = computed({
  get: () => String(probe.tipPosition[1]),
  set: (value: string) => (probe.tipPosition[1] = Number(value))
});

const ml = computed({
  get: () => String(probe.tipPosition[2]),
  set: (value: string) => (probe.tipPosition[2] = Number(value))
});

const roll = computed({
  get: () => String(probe.orientation[0]),
  set: (value: string) => (probe.orientation[0] = Number(value))
});

const yaw = computed({
  get: () => String(probe.orientation[1]),
  set: (value: string) => (probe.orientation[1] = Number(value))
});

const pitch = computed({
  get: () => String(probe.orientation[2]),
  set: (value: string) => (probe.orientation[2] = Number(value))
});

const nameRules: ValidationRule<string>[] = [
  value => value.trim().length > 0 || t("probeInspector.nameRequired"),
  value =>
    isProbeNameAvailable(currentExperimentStore.experiment, probe, value) ||
    t("probeInspector.nameTaken")
];

const numberRules: ValidationRule<string>[] = [
  value =>
    (value.trim().length > 0 && Number.isFinite(Number(value))) ||
    t("probeInspector.mustBeNumber")
];
</script>

<template>
  <div class="column q-gutter-y-md">
    <CommittedInput
      v-model="name"
      :label="t('probeInspector.name')"
      outlined
      :rules="nameRules"
    />

    <q-select
      v-model="probeIdentifier"
      :label="t('probeInspector.probeType')"
      :options="probeIdentifiers"
      outlined
    />

    <div>
      <p class="text-h6">{{ t("probeInspector.tipPosition") }}</p>
      <div class="row q-gutter-x-sm">
        <CommittedInput
          v-model="ap"
          class="col"
          dense
          :label="t('probeInspector.ap')"
          outlined
          :rules="numberRules"
        />
        <CommittedInput
          v-model="dv"
          class="col"
          dense
          :label="t('probeInspector.dv')"
          outlined
          :rules="numberRules"
        />
        <CommittedInput
          v-model="ml"
          class="col"
          dense
          :label="t('probeInspector.ml')"
          outlined
          :rules="numberRules"
        />
      </div>
    </div>

    <div>
      <p class="text-h6">{{ t("probeInspector.orientation") }}</p>
      <div class="row q-gutter-x-sm">
        <CommittedInput
          v-model="roll"
          class="col"
          dense
          :label="t('probeInspector.roll')"
          outlined
          :rules="numberRules"
        />
        <CommittedInput
          v-model="yaw"
          class="col"
          dense
          :label="t('probeInspector.yaw')"
          outlined
          :rules="numberRules"
        />
        <CommittedInput
          v-model="pitch"
          class="col"
          dense
          :label="t('probeInspector.pitch')"
          outlined
          :rules="numberRules"
        />
      </div>
    </div>

    <div>
      <p class="text-h6">{{ t("probeInspector.color") }}</p>
      <q-color
        v-model="probe.color"
        :palette="STANDARD_COLORS"
        default-view="palette"
      />
    </div>
  </div>
</template>

<style lang="sass" scoped></style>
