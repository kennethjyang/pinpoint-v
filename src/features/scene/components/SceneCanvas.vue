<script lang="ts" setup>
import {
  computed,
  onMounted,
  onUnmounted,
  useTemplateRef,
  watchEffect
} from "vue";
import { useQuasar } from "quasar";
import { useBabylonRuntimeService } from "@/composable/useBabylonRuntimeService";
import {
  setAtlasRootReference,
  setInitialZoom,
  StructureEntity,
  syncStructureVisibility
} from "@/features/scene";
import { structureEntityFromIdentifier } from "@/features/atlas";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

const currentExperiment = useCurrentExperimentStore();
const runtime = useBabylonRuntimeService();
const $q = useQuasar();

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");

/**
 * Atlas structures that must always be present in the scene, faded out when
 * not visible instead of being removed.
 */
const alwaysPresentStructures = computed<StructureEntity[]>(() => {
  const { atlas, terminologyRows } = currentExperiment;
  if (!atlas || !terminologyRows) return [];

  return currentExperiment.defaultStructureIdentifiers.flatMap(identifier => {
    const structureEntity = structureEntityFromIdentifier(
      atlas,
      terminologyRows,
      identifier
    );
    return structureEntity ? [structureEntity] : [];
  });
});

/**
 * Structures the current experiment has marked visible.
 */
const visibleStructures = computed<StructureEntity[]>(() => {
  const { atlas, terminologyRows } = currentExperiment;
  if (!atlas || !terminologyRows) return [];

  return currentExperiment.visibleStructures.flatMap(identifier => {
    const structureEntity = structureEntityFromIdentifier(
      atlas,
      terminologyRows,
      identifier
    );
    return structureEntity ? [structureEntity] : [];
  });
});

/**
 * Trigger engine resizing on page area resize.
 */
function onResize() {
  runtime.engine.value?.resize();
}

onMounted(async () => {
  // Exit if no canvas.
  if (!canvas.value) {
    throw new Error("Scene canvas not found in DOM!");
  }

  // Initialize Babylon runtime.
  await runtime.init(canvas.value);

  // Keep the scene in sync with the current atlas's default structures and the
  // experiment's visible structure selection.
  watchEffect(async () => {
    const scene = runtime.scene.value;
    if (!scene) return;

    $q.loadingBar.start(0);
    try {
      await syncStructureVisibility(
        scene,
        alwaysPresentStructures.value,
        visibleStructures.value,
        (completed, total) => $q.loadingBar.increment((completed / total) * 100)
      );
    } finally {
      $q.loadingBar.stop();
    }
  });

  // Keep the atlas root positioned so the experiment's reference coordinate
  // sits at the scene origin.
  watchEffect(() => {
    const scene = runtime.scene.value;
    if (!scene) return;

    setAtlasRootReference(scene, currentExperiment.referenceCoordinate);
  });

  // Set the camera's initial zoom relative to the AP length of the atlas.
  watchEffect(() => {
    const camera = runtime.camera.value;
    if (!camera || !currentExperiment.manifest) return;

    setInitialZoom(currentExperiment.manifest, camera);
  });
});

onUnmounted(() => {
  runtime.dispose();
});
</script>

<template>
  <canvas ref="canvas" class="fit" />
  <q-resize-observer @resize="onResize" />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
