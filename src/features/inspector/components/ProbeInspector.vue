<script lang="ts" setup>
import { computed, onUnmounted, ref, toRaw, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  copyProbe,
  findProbeInterfaceProbeByIdentifier,
  getProbeContour,
  getProbeInterfaceDisplayName,
  getProbeInterfaceIdentifier,
  getProbeShankBasePositionMillimeters,
  getProbeShanks,
  homeProbe,
  type Probe,
  setProbeTipMillimeters,
  toggleProbeLock
} from "@/features/probe";
import {
  buildSceneModel,
  STANDARD_COLORS,
  useModelFileImport
} from "@/features/scene";
import { SliceCanvas, useProbeSurface } from "@/features/slice";
import type { CoordinateSystemNode } from "@/features/coordinate-system";
import ProbeBodyModelInspector from "./ProbeBodyModelInspector.vue";
import ProbeTransformChain from "./ProbeTransformChain.vue";
import { useProbeLibraryStore } from "@/stores/probe-library.store";
import { setProbeInterface } from "@/features/experiment";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { useCoordinateSystemLibraryStore } from "@/stores/coordinate-system-library.store";
import { useValidationRules } from "@/composable/useValidationRules";
import { useNotify } from "@/composable/useNotify";
import CommittedInput from "@/components/CommittedInput.vue";

// A library probe's identifier paired with its display label. `emit-value`
// keeps the model the identifier, which `findProbeInterfaceProbeByIdentifier`
// needs.
interface ProbeTypeOption {
  label: string;
  value: string;
}

// One shank-alignment choice. `null` is the contour-center option; `attrs` puts a
// stable aria-label on the rendered button (Quasar spreads it onto each `q-btn`).
interface ShankAlignmentOption {
  label: string;
  value: number | null;
  attrs: { "aria-label": string };
}

// A library coordinate system's id paired with its name. `emit-value` keeps the
// model the id.
interface CoordinateSystemOption {
  label: string;
  value: string;
}

const { probe } = defineProps<{
  probe: Probe;
}>();

const probeLibraryStore = useProbeLibraryStore();
const currentExperimentStore = useCurrentExperimentStore();
const coordinateSystemLibraryStore = useCoordinateSystemLibraryStore();
const { requiredName: nameRules } = useValidationRules();

const { t } = useI18n();
const { notifyWarning } = useNotify();
const { findTargets } = useProbeSurface();

/** Is the surface sampling pass currently running. */
const isFindingSurface = ref(false);

/** Id of the library coordinate system whose chain the transform inputs edit. */
const coordinateSystemId = ref(
  coordinateSystemLibraryStore.library[0]?.id ?? ""
);

/**
 * Working copy of the selected coordinate system's chain. Detached from the library so
 * editing a value here never rewrites the shared definition.
 */
const chain = ref<CoordinateSystemNode[]>([]);

/**
 * Aborts the in-flight surface sampling. Deliberately a plain `let`, not a ref:
 * nothing renders it and replacing it must not retrigger effects.
 */
let surfaceAbortController: AbortController | null = null;

/**
 * Link to the probe identifier that also repoints its interned interface
 * definition after switching.
 */
const probeIdentifier = computed({
  get: () => probe.probeInterfaceIdentifier,
  set: (value: string) => {
    const probeInterfaceProbe = findProbeInterfaceProbeByIdentifier(
      probeLibraryStore.library,
      value
    );
    if (!probeInterfaceProbe) return;

    setProbeInterface(
      currentExperimentStore.experiment,
      probe,
      probeInterfaceProbe
    );
  }
});

const probeTypeOptions = computed<ProbeTypeOption[]>(() =>
  probeLibraryStore.library.map(probeInterfaceProbe => ({
    label: getProbeInterfaceDisplayName(probeInterfaceProbe),
    value: getProbeInterfaceIdentifier(probeInterfaceProbe)
  }))
);

const coordinateSystemOptions = computed<CoordinateSystemOption[]>(() =>
  coordinateSystemLibraryStore.library.map(({ id, name }) => ({
    label: name,
    value: id
  }))
);

/** This probe's interned interface definition, or null when the experiment has none. */
const probeInterfaceProbe = computed(
  () =>
    currentExperimentStore.probeInterfaceProbes[
      probe.probeInterfaceIdentifier
    ] ?? null
);

/** This probe's contour in probe-local mm, or null when its definition has none. */
const contour = computed(() =>
  probeInterfaceProbe.value ? getProbeContour(probeInterfaceProbe.value) : null
);

const shanks = computed(() =>
  probeInterfaceProbe.value && contour.value
    ? getProbeShanks(probeInterfaceProbe.value, contour.value)
    : []
);

// Declared with its derived inputs: an imported model starts at the shank base.
const { isImporting: isImportingBodyModel, open: openBodyModelFile } =
  useModelFileImport(modelId => {
    const model = buildSceneModel(modelId);
    if (contour.value) {
      model.position = getProbeShankBasePositionMillimeters(
        contour.value,
        shanks.value,
        probe.shankAlignmentIndex
      );
    }
    probe.bodyModel = model;
  });

/**
 * One button per shank, left to right, with the center option inserted in the
 * middle. Empty for a single-shank probe, which needs no choice.
 */
const shankAlignmentOptions = computed<ShankAlignmentOption[]>(() => {
  if (shanks.value.length < 2) return [];
  const options = shanks.value.map<ShankAlignmentOption>((_, index) => ({
    label: String(index),
    value: index,
    attrs: { "aria-label": t("probeInspector.alignShank", { index }) }
  }));
  options.splice(Math.ceil(options.length / 2), 0, {
    label: t("probeInspector.alignCenterLabel"),
    value: null,
    attrs: { "aria-label": t("probeInspector.alignCenter") }
  });
  return options;
});

const name = computed({
  get: () => probe.name,
  set: (value: string) => (probe.name = value.trim())
});

const lockIcon = computed(() =>
  probe.lock ? "lock" : "sym_o_lock_open_right"
);

const lockColor = computed(() => (probe.lock ? "accent" : undefined));

const lockLabel = computed(() =>
  probe.lock ? t("probeInspector.unlock") : t("probeInspector.lock")
);

const bodyModelButtonLabel = computed(() =>
  probe.bodyModel
    ? t("probeInspector.replaceBodyModel")
    : t("probeInspector.uploadBodyModel")
);

/**
 * Is a surface move in progress - sampling, or awaiting the user's path pick. A move
 * is incomplete until the tip lands, so this covers both phases.
 */
const isMovingToSurface = computed(
  () =>
    isFindingSurface.value ||
    currentExperimentStore.probeSurfaceChoice?.probeId === probe.id
);

const surfaceIcon = computed(() =>
  isMovingToSurface.value ? "cancel" : "sym_o_place_item"
);

const surfaceLabel = computed(() =>
  isMovingToSurface.value
    ? t("probeInspector.cancelSurface")
    : t("probeInspector.surface")
);

/** Re-clone the selected library coordinate system's chain into the working copy. */
function seedChain(): void {
  const coordinateSystem = coordinateSystemLibraryStore.library.find(
    ({ id }) => id === coordinateSystemId.value
  );
  chain.value = coordinateSystem
    ? structuredClone(toRaw(coordinateSystem)).chain
    : [];
}

/**
 * Abort an in-flight surface move, dropping any path choice awaiting a pick - which
 * disposes its tubes, since `SceneCanvas`'s draw effect rebuilds from
 * `probeSurfaceChoice` and calls `disposeProbeSurfacePaths` when it is null.
 */
function cancelMoveToSurface(): void {
  surfaceAbortController?.abort();
  surfaceAbortController = null;
  if (currentExperimentStore.probeSurfaceChoice?.probeId === probe.id) {
    currentExperimentStore.probeSurfaceChoice = null;
  }
}

/**
 * Move the probe's tip onto the brain surface, or request a path pick when both an
 * along-axis and a down-on-DV move are available.
 */
async function moveToSurface(): Promise<void> {
  const controller = new AbortController();
  surfaceAbortController = controller;
  isFindingSurface.value = true;
  try {
    const targets = await findTargets(probe, controller.signal);
    // An abort that lands after the rays resolved must still not move the probe. No
    // toast either: the user asked for this to stop, so it is not a failure.
    if (controller.signal.aborted) return;
    if (!targets) {
      notifyWarning(
        t("probeInspector.surfaceUnavailable"),
        t("probeInspector.surfaceUnavailableCaption")
      );
      return;
    }

    const { insideMillimeters, axisMillimeters, dorsoventralMillimeters } =
      targets;
    if (insideMillimeters) {
      setProbeTipMillimeters(probe, insideMillimeters);
      return;
    }
    if (!axisMillimeters && !dorsoventralMillimeters) {
      notifyWarning(
        t("probeInspector.noSurfaceFound"),
        t("probeInspector.noSurfaceFoundCaption")
      );
      return;
    }
    if (!axisMillimeters || !dorsoventralMillimeters) {
      setProbeTipMillimeters(
        probe,
        axisMillimeters ?? dorsoventralMillimeters!
      );
      return;
    }

    currentExperimentStore.probeSurfaceChoice = {
      probeId: probe.id,
      tipPosition: [...probe.tipPosition],
      rotation: [...probe.rotation],
      axisTargetMillimeters: axisMillimeters,
      dorsoventralTargetMillimeters: dorsoventralMillimeters
    };
  } finally {
    isFindingSurface.value = false;
    if (surfaceAbortController === controller) surfaceAbortController = null;
  }
}

/** Start a surface move, or cancel the one already in progress. */
function onSurfaceClick(): void {
  if (isMovingToSurface.value) {
    cancelMoveToSurface();
    return;
  }
  void moveToSurface();
}

// A different probe or a different coordinate system starts from the library's values.
watch([() => probe.id, coordinateSystemId], seedChain, { immediate: true });

onUnmounted(cancelMoveToSurface);
</script>

<template>
  <q-list class="probe-inspector">
    <q-expansion-item
      default-opened
      header-class="text-weight-bold"
      icon="sym_o_transition_chop"
      :label="t('probeInspector.inPlaneSlice')"
    >
      <div class="q-py-md">
        <div class="column no-wrap q-gutter-y-md">
          <SliceCanvas :probe="probe" />
        </div>
      </div>
    </q-expansion-item>
    <q-separator />
    <q-expansion-item
      default-opened
      header-class="text-weight-bold"
      icon="sym_o_page_info"
      :label="t('probeInspector.properties')"
    >
      <div class="q-py-md">
        <div class="column no-wrap q-gutter-y-md">
          <div>
            <q-btn-group spread>
              <q-btn
                :aria-label="t('probeInspector.home')"
                :disable="probe.lock"
                icon="home"
                @click="
                  homeProbe(probe, currentExperimentStore.referenceCoordinate)
                "
              >
                <q-tooltip>{{ t("probeInspector.home") }}</q-tooltip>
              </q-btn>
              <q-btn
                :aria-label="surfaceLabel"
                :disable="probe.lock && !isMovingToSurface"
                :icon="surfaceIcon"
                @click="onSurfaceClick"
              >
                <q-tooltip>{{ surfaceLabel }}</q-tooltip>
              </q-btn>
              <q-btn
                :aria-label="t('probeInspector.copy')"
                icon="content_copy"
                @click="copyProbe(currentExperimentStore.experiment, probe)"
              >
                <q-tooltip>{{ t("probeInspector.copy") }}</q-tooltip>
              </q-btn>
              <q-btn
                :aria-label="lockLabel"
                :icon="lockIcon"
                @click="toggleProbeLock(probe)"
                :color="lockColor"
              >
                <q-tooltip>{{ t("probeInspector.lock") }}</q-tooltip>
              </q-btn>
            </q-btn-group>

            <q-linear-progress
              v-if="isMovingToSurface"
              indeterminate
              color="primary"
              size="sm"
            />
          </div>

          <CommittedInput
            v-model="name"
            :label="t('probeInspector.name')"
            hide-bottom-space
            outlined
            :rules="nameRules"
          />

          <q-select
            v-model="probeIdentifier"
            emit-value
            :label="t('probeInspector.probeType')"
            map-options
            :options="probeTypeOptions"
            outlined
          />

          <div v-if="shankAlignmentOptions.length">
            <div class="text-body2 q-pb-xs">{{
              t("probeInspector.centeredShankIndex")
            }}</div>
            <q-btn-toggle
              v-model="probe.shankAlignmentIndex"
              :aria-label="t('probeInspector.shankAlignment')"
              :disable="probe.lock"
              :options="shankAlignmentOptions"
              spread
              toggle-color="primary"
            />
          </div>

          <q-select
            v-model="coordinateSystemId"
            emit-value
            :label="t('probeInspector.coordinateSystem')"
            map-options
            :options="coordinateSystemOptions"
            outlined
          />

          <ProbeTransformChain :chain="chain" :disable="probe.lock" />

          <div>
            <q-color
              v-model="probe.color"
              :palette="STANDARD_COLORS"
              default-view="palette"
            />
          </div>
        </div>
      </div>
    </q-expansion-item>
    <q-separator />
    <q-expansion-item
      default-opened
      header-class="text-weight-bold"
      icon="sym_o_deployed_code"
      :label="t('probeInspector.bodyModel')"
    >
      <div class="q-py-md">
        <div class="column no-wrap q-gutter-y-md">
          <q-btn
            :aria-label="bodyModelButtonLabel"
            class="full-width"
            icon="sym_o_upload_file"
            :label="bodyModelButtonLabel"
            :loading="isImportingBodyModel"
            @click="openBodyModelFile"
          />
          <template v-if="probe.bodyModel">
            <ProbeBodyModelInspector
              :body-model="probe.bodyModel"
              :disable="probe.lock"
              :probe-id="probe.id"
            />
            <q-btn
              :aria-label="t('probeInspector.removeBodyModel')"
              class="full-width"
              color="negative"
              icon="delete"
              :label="t('probeInspector.removeBodyModel')"
              @click="probe.bodyModel = null"
            />
          </template>
        </div>
      </div>
    </q-expansion-item>
  </q-list>
</template>

<style lang="sass" scoped>
// Without this, the long probe-type label's intrinsic content width forces
// this flex item to grow past its drawer's width instead of wrapping/eliding.
.probe-inspector
  width: 100%

  :deep(.q-select)
    width: 100%
    min-width: 0

  :deep(.q-field__native > span)
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap
</style>
