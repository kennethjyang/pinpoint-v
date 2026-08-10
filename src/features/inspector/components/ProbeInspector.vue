<script lang="ts" setup>
import { computed, onUnmounted, ref, type WritableComputedRef } from "vue";
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
  insertProbeTipToMillimeters,
  type Probe,
  setProbeTipMillimeters,
  toggleProbeLock
} from "@/features/probe";
import {
  buildSceneModel,
  findTransformChain,
  getTransformChainLabel,
  getTransformChainPose,
  getTransformChains,
  isTransformInputBound,
  moveTransformChainOrigin,
  STANDARD_COLORS,
  TRANSFORM_INPUT_GROUPS,
  type TransformInputComponent,
  type TransformInputGroup,
  type TransformStepKind,
  useModelFileImport
} from "@/features/scene";
import { SliceCanvas, useProbeSurface } from "@/features/slice";
import ProbeBodyModelInspector from "./ProbeBodyModelInspector.vue";
import { useProbeLibraryStore } from "@/stores/probe-library.store";
import { setProbeInterface } from "@/features/experiment";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { usePreferencesStore } from "@/stores/preferences.store";
import { useNumericTupleModel } from "@/composable/useNumericTupleModel";
import { useUnitLabels } from "@/composable/useUnitLabels";
import { useValidationRules } from "@/composable/useValidationRules";
import { useNotify } from "@/composable/useNotify";
import CommittedInput from "@/components/CommittedInput.vue";
import {
  millimetersToPositionUnit,
  positionUnitToMillimeters,
  radiansToRotationUnit,
  rotationUnitToRadians
} from "@/utils/math";

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

/** Unit kind of each transform input group's three values. */
const TRANSFORM_INPUT_GROUP_KINDS: Readonly<
  Record<TransformInputGroup, TransformStepKind>
> = {
  globalTranslation: "translation",
  globalRotation: "rotation",
  localRotation: "rotation",
  localTranslation: "translation"
};

/** Every component slot of an input group, in the order its row lists them. */
const TRANSFORM_INPUT_COMPONENTS: readonly TransformInputComponent[] = [
  0, 1, 2
];

/** One transform input's writable display model, paired with the slot it edits. */
interface TransformInputField {
  component: TransformInputComponent;
  model: WritableComputedRef<string>;
}

/** One row of transform inputs: an input group's three fields. */
interface TransformInputRow {
  group: TransformInputGroup;
  kind: TransformStepKind;
  fields: TransformInputField[];
}

const { probe } = defineProps<{
  probe: Probe;
}>();

const probeLibraryStore = useProbeLibraryStore();
const currentExperimentStore = useCurrentExperimentStore();
const preferences = usePreferencesStore();
const unitLabels = useUnitLabels();
const { requiredName: nameRules, optionalNumber: numberRules } =
  useValidationRules();

const { t } = useI18n();
const { notifyWarning } = useNotify();
const { findTargets } = useProbeSurface();

/** Is the surface sampling pass currently running. */
const isFindingSurface = ref(false);

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

/** Every transform chain the probe can be posed through. */
const chains = computed(() => getTransformChains(preferences.transformChains));

/** Chain mapping this probe's twelve transform inputs onto its pose. */
const chain = computed(() =>
  findTransformChain(chains.value, probe.transformChainId)
);

const chainOptions = computed(() =>
  chains.value.map(candidate => ({
    label: getTransformChainLabel(candidate, key => t(key)),
    value: candidate.id
  }))
);

// Declared with its derived inputs: an imported model starts at the shank base.
const { isImporting: isImportingBodyModel, open: openBodyModelFile } =
  useModelFileImport(modelId => {
    const model = buildSceneModel(modelId);
    if (contour.value) {
      moveTransformChainOrigin(
        model.transformInputs,
        findTransformChain(chains.value, model.transformChainId),
        getProbeShankBasePositionMillimeters(
          contour.value,
          shanks.value,
          probe.shankAlignmentIndex
        )
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

const positionSuffix = computed(() =>
  unitLabels.position(preferences.positionUnit)
);

const rotationSuffix = computed(() =>
  unitLabels.rotation(preferences.rotationUnit)
);
const name = computed({
  get: () => probe.name,
  set: (value: string) => (probe.name = value.trim())
});

/**
 * Writable display models for the probe's twelve transform inputs, one row per
 * input group. Built up front: a composable cannot be created inside `v-for`.
 */
const transformInputRows: TransformInputRow[] = TRANSFORM_INPUT_GROUPS.map(
  group => ({
    group,
    kind: TRANSFORM_INPUT_GROUP_KINDS[group],
    fields: TRANSFORM_INPUT_COMPONENTS.map(component => ({
      component,
      model:
        TRANSFORM_INPUT_GROUP_KINDS[group] === "rotation"
          ? useNumericTupleModel(
              () => probe.transformInputs[group],
              component,
              radians =>
                radiansToRotationUnit(radians, preferences.rotationUnit),
              value => rotationUnitToRadians(value, preferences.rotationUnit),
              () => preferences.decimalPrecision
            )
          : useNumericTupleModel(
              () => probe.transformInputs[group],
              component,
              millimeters =>
                millimetersToPositionUnit(
                  millimeters,
                  preferences.positionUnit
                ),
              value =>
                positionUnitToMillimeters(value, preferences.positionUnit),
              () => preferences.decimalPrecision
            )
    }))
  })
);

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

/** Warn that the probe has no brain surface it can reach. */
function notifyNoSurfaceFound(): void {
  notifyWarning(
    t("probeInspector.noSurfaceFound"),
    t("probeInspector.noSurfaceFoundCaption")
  );
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
    const referenceCoordinate = currentExperimentStore.referenceCoordinate;
    const targets = await findTargets(
      probe,
      chain.value,
      referenceCoordinate,
      controller.signal
    );
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
    // The inside and axis targets both sit on the probe's own axis, so they
    // advance its chain's depth input; only the DV target is a world move.
    if (insideMillimeters) {
      if (
        !insertProbeTipToMillimeters(
          probe,
          chain.value,
          insideMillimeters,
          referenceCoordinate
        )
      ) {
        notifyNoSurfaceFound();
      }
      return;
    }
    if (axisMillimeters && dorsoventralMillimeters) {
      const { position } = getTransformChainPose(
        chain.value,
        probe.transformInputs
      );
      currentExperimentStore.probeSurfaceChoice = {
        probeId: probe.id,
        transformInputs: {
          globalTranslation: [...probe.transformInputs.globalTranslation],
          globalRotation: [...probe.transformInputs.globalRotation],
          localRotation: [...probe.transformInputs.localRotation],
          localTranslation: [...probe.transformInputs.localTranslation]
        },
        tipMillimeters: [
          referenceCoordinate[0] + position[0],
          referenceCoordinate[1] + position[1],
          referenceCoordinate[2] + position[2]
        ],
        axisTargetMillimeters: axisMillimeters,
        dorsoventralTargetMillimeters: dorsoventralMillimeters
      };
      return;
    }
    if (axisMillimeters) {
      if (
        !insertProbeTipToMillimeters(
          probe,
          chain.value,
          axisMillimeters,
          referenceCoordinate
        )
      ) {
        notifyNoSurfaceFound();
      }
      return;
    }
    if (dorsoventralMillimeters) {
      setProbeTipMillimeters(
        probe,
        chain.value,
        dorsoventralMillimeters,
        referenceCoordinate
      );
      return;
    }
    notifyNoSurfaceFound();
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
                @click="homeProbe(probe)"
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
            v-model="probe.transformChainId"
            :disable="probe.lock"
            emit-value
            :label="t('probeInspector.transformChain')"
            map-options
            :options="chainOptions"
            outlined
          />

          <div v-for="row in transformInputRows" :key="row.group">
            <div class="text-body2 q-pb-xs">{{
              t(`transformChain.${row.group}`)
            }}</div>
            <div class="row q-gutter-x-sm">
              <CommittedInput
                v-for="field in row.fields"
                :key="field.component"
                v-model="field.model.value"
                :disable="
                  probe.lock ||
                  !isTransformInputBound(chain, {
                    group: row.group,
                    component: field.component
                  })
                "
                :label="
                  preferences.transformInputNames[row.group][field.component]
                "
                :rules="numberRules"
                :suffix="
                  row.kind === 'rotation' ? rotationSuffix : positionSuffix
                "
                class="col"
                hide-bottom-space
                outlined
              />
            </div>
          </div>

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
