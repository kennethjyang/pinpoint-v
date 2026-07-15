<script lang="ts" setup>
import {
  computed,
  onMounted,
  onUnmounted,
  useTemplateRef,
  watchEffect
} from "vue";
import { useBabylonRuntimeService } from "@/composable/useBabylonRuntimeService";
import {
  setAtlasRootReference,
  syncStructureVisibility
} from "@/features/scene";
import { StructureEntity, structureEntityFromId } from "@/features/atlas";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const runtime = useBabylonRuntimeService();
const currentExperiment = useCurrentExperimentStore();

/**
 * Atlas structures that must always be present in the scene, faded out when
 * not visible instead of being removed.
 */
const alwaysPresentStructures = computed<StructureEntity[]>(() => {
  const { atlas, metadata } = currentExperiment;
  if (!atlas || !metadata) return [];

  return currentExperiment.defaultStructureIds.flatMap(id => {
    const structureEntity = structureEntityFromId(atlas, metadata, id);
    return structureEntity ? [structureEntity] : [];
  });
});

/**
 * Structures the current experiment has marked visible.
 */
const visibleStructures = computed<StructureEntity[]>(() => {
  const { atlas, metadata } = currentExperiment;
  if (!atlas || !metadata) return [];

  return currentExperiment.visibleStructures.flatMap(id => {
    const structureEntity = structureEntityFromId(atlas, metadata, id);
    return structureEntity ? [structureEntity] : [];
  });
});

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

    await syncStructureVisibility(
      scene,
      alwaysPresentStructures.value,
      visibleStructures.value
    );
  });

  // Keep the atlas root positioned so the experiment's reference coordinate
  // sits at the scene origin.
  watchEffect(() => {
    const scene = runtime.scene.value;
    if (!scene) return;

    setAtlasRootReference(scene, currentExperiment.referenceCoordinate);
  });
});

onUnmounted(() => {
  runtime.dispose();
});

/**
 * Trigger engine resizing on page area resize.
 */
function onResize() {
  runtime.engine.value?.resize();
}
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
