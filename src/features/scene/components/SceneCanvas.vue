<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, watch } from "vue";
import { useBabylonRuntimeService } from "@/composable/useBabylonRuntimeService";
import {
  addStructure,
  buildAtlasRootNode,
  removeStructure,
  setStructureAlpha
} from "@/features/scene";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const runtime = useBabylonRuntimeService();
const currentAtlas = useCurrentAtlas();
const currentExperiment = useCurrentExperimentStore();

onMounted(async () => {
  // Exit if no canvas.
  if (!canvas.value) {
    throw new Error("Scene canvas not found in DOM!");
  }

  // Initialize Babylon runtime.
  await runtime.init(canvas.value);

  // Keep the scene in sync with the current atlas's default structures and the
  // experiment's visible structure selection.
  watch(
    [
      runtime.scene,
      currentAtlas.defaultStructureIds,
      () => [...currentExperiment.visibleStructures]
    ],
    async ([scene, defaultStructureIds, visibleStructures]) => {
      // Exit if the scene is not ready.
      if (!scene) return;

      // Default structures are always present; fade them in/out instead of removing.
      for (const structureEntity of defaultStructureIds.map(id =>
        currentAtlas.structureEntityFromId(id)
      )) {
        // Skip malformed structures.
        if (!structureEntity) continue;

        // Ensure the structure is in the scene.
        await addStructure(structureEntity, scene);

        // Set alpha depending on visibility.
        setStructureAlpha(
          structureEntity,
          currentExperiment.isStructureVisible(Number(structureEntity.name))
            ? 1
            : 0.1,
          scene
        );
      }

      // Non-default structures are added/removed based on visibility.
      const nonDefaultStructures = visibleStructures.filter(
        id => !defaultStructureIds.includes(id)
      );

      // Ensure all structures are added.
      for (const structureEntity of nonDefaultStructures.map(id =>
        currentAtlas.structureEntityFromId(id)
      )) {
        if (!structureEntity) continue;
        await addStructure(structureEntity, scene);
      }

      // Get all structures to remove.
      const needsRemovalStructureIds = buildAtlasRootNode(scene)
        .getChildren()
        .map(child => child.name)
        .filter(
          name =>
            !defaultStructureIds.includes(+name) &&
            !nonDefaultStructures.includes(+name)
        );

      for (const needsRemovalStructureEntity of needsRemovalStructureIds.map(
        id => currentAtlas.structureEntityFromId(+id)
      )) {
        if (!needsRemovalStructureEntity) continue;
        removeStructure(needsRemovalStructureEntity, scene);
      }
    },
    { immediate: true }
  );
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
