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
import {
  type CoordinateSystemNode,
  type CoordinateSystemSolution,
  getCoordinateSystemAxisValue,
  setCoordinateSystemAxisValue,
  solveCoordinateSystemChain
} from "@/features/coordinate-system";
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
const { findTargets, isOnSurface } = useProbeSurface();

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

/** Indexes into `chain` of `onSurface` nodes the atlas rejects as off-surface. */
const offSurfaceNodeIndexes = ref<number[]>([]);

/**
 * Aborts the in-flight surface sampling. Deliberately a plain `let`, not a ref:
 * nothing renders it and replacing it must not retrigger effects.
 */
let surfaceAbortController: AbortController | null = null;

/**
 * Guards a surface check against a superseded commit. Deliberately a plain
 * `let`, not a ref: nothing renders it.
 */
let surfaceCheckId = 0;

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

/** Library coordinate system the transform inputs edit, or null when it is gone. */
const selectedCoordinateSystem = computed(
  () =>
    coordinateSystemLibraryStore.library.find(
      ({ id }) => id === coordinateSystemId.value
    ) ?? null
);

/** Root translation the chain hangs off, in atlas ASR mm, or null for the atlas origin. */
const referenceOffset = computed(() =>
  selectedCoordinateSystem.value?.offsetByReferenceCoordinate
    ? currentExperimentStore.referenceCoordinate
    : null
);

/**
 * The chain's single all-adjustable node, or null when the chain is not exactly
 * invertible from the probe's pose.
 */
const directNode = computed(() => {
  const [node] = chain.value;
  if (chain.value.length !== 1 || !node) return null;
  return [...node.position, ...node.rotation].some(({ fixed }) => fixed)
    ? null
    : node;
});

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

/**
 * Write the probe's live pose into the direct chain's single node.
 * @param node Direct chain node to write, mutated in place.
 */
function writeProbePoseIntoNode(node: CoordinateSystemNode): void {
  const offset = referenceOffset.value ?? [0, 0, 0];
  const [ap, dv, ml] = probe.tipPosition;
  setCoordinateSystemAxisValue(node, "position", 0, ml - offset[2]);
  setCoordinateSystemAxisValue(node, "position", 1, dv - offset[1]);
  setCoordinateSystemAxisValue(node, "position", 2, ap - offset[0]);
  const [roll, yaw, pitch] = probe.rotation;
  setCoordinateSystemAxisValue(node, "rotation", 0, pitch);
  setCoordinateSystemAxisValue(node, "rotation", 1, yaw);
  setCoordinateSystemAxisValue(node, "rotation", 2, roll);
}

/**
 * Solve a direct chain's single node into a probe pose without the matrix chain, so
 * a value reaches the probe exactly as typed.
 * @param node Direct chain node to solve.
 */
function solveDirectNode(node: CoordinateSystemNode): CoordinateSystemSolution {
  const offset = referenceOffset.value ?? [0, 0, 0];
  const tipPosition: [number, number, number] = [
    getCoordinateSystemAxisValue(node, "position", 2) + offset[0],
    getCoordinateSystemAxisValue(node, "position", 1) + offset[1],
    getCoordinateSystemAxisValue(node, "position", 0) + offset[2]
  ];
  return {
    tipPosition,
    rotation: [
      getCoordinateSystemAxisValue(node, "rotation", 2),
      getCoordinateSystemAxisValue(node, "rotation", 1),
      getCoordinateSystemAxisValue(node, "rotation", 0)
    ],
    nodePositions: [tipPosition]
  };
}

/** Re-clone the selected library coordinate system's chain into the working copy. */
function seedChain(): void {
  chain.value = selectedCoordinateSystem.value
    ? structuredClone(toRaw(selectedCoordinateSystem.value)).chain
    : [];
  offSurfaceNodeIndexes.value = [];

  // A single all-adjustable node is exactly invertible from the probe's pose, so
  // the default coordinate system reads and writes live state. Any other chain
  // shape is not invertible, so it keeps the library's values.
  const node = directNode.value;
  if (node) writeProbePoseIntoNode(node);
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

/** Re-solve the working chain onto the probe and recheck its surface nodes. */
function applySolve(): void {
  const node = directNode.value;
  const solution = node
    ? solveDirectNode(node)
    : solveCoordinateSystemChain(chain.value, referenceOffset.value);
  setProbeTipMillimeters(probe, solution.tipPosition);
  probe.rotation = [...solution.rotation];
  void checkSurfaceNodes(solution);
}

/**
 * Replace the off-surface warnings with the on-surface nodes the atlas rejects.
 * @param solution Solved chain the node positions come from.
 */
async function checkSurfaceNodes(
  solution: CoordinateSystemSolution
): Promise<void> {
  const checkId = ++surfaceCheckId;
  const indexes = chain.value.flatMap((node, index) =>
    node.onSurface ? [index] : []
  );
  if (indexes.length === 0) {
    offSurfaceNodeIndexes.value = [];
    return;
  }
  const results = await Promise.all(
    indexes.map(index => isOnSurface(solution.nodePositions[index]!))
  );
  if (checkId !== surfaceCheckId) return;
  offSurfaceNodeIndexes.value = indexes.filter(
    (_, position) => results[position] === false
  );
}

// A different probe or a different coordinate system starts from the library's values.
watch([() => probe.id, coordinateSystemId], seedChain, { immediate: true });

// The scene writes the probe's pose straight into state on every gizmo drag frame,
// so mirror it back into a direct chain to keep the inputs live. Nothing is written
// to the probe here, so the drag still lands as the single history point
// `endProbeDrag` commits on release.
watch(
  [() => probe.tipPosition, () => probe.rotation, referenceOffset],
  () => {
    const node = directNode.value;
    if (node) writeProbePoseIntoNode(node);
  },
  { deep: true }
);

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

          <ProbeTransformChain
            :chain="chain"
            :disable="probe.lock"
            :off-surface-node-indexes="offSurfaceNodeIndexes"
            @commit="applySolve"
          />

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
