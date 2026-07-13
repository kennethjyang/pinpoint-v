<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, watch } from "vue";
import { useBabylonRuntimeService } from "@/composable/useBabylonRuntimeService";
import {
  addStructure,
  removeStructure,
  setStructureAlpha
} from "@/features/scene";
import { useCurrentAtlas } from "@/composable/useCurrentAtlas";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { StructureEntity } from "@/models/atlas.model";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const runtime = useBabylonRuntimeService();
const currentAtlas = useCurrentAtlas();
const currentExperiment = useCurrentExperimentStore();

/**
 * Non-default structures currently added to the scene, keyed by structure name, so
 * they can be removed again without needing to be rebuilt.
 */
const addedStructures = new Map<string, StructureEntity>();

const ALPHA_HIDDEN = 0.1;
const ALPHA_VISIBLE = 1;

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
      currentAtlas.defaultStructureEntities,
      () => [...currentExperiment.visibleStructures]
    ],
    async ([scene, defaultStructures]) => {
      if (!scene || !defaultStructures) return;

      // Default structures are always present; fade them in/out instead of removing.
      for (const structure of defaultStructures) {
        await addStructure(structure, scene);
        setStructureAlpha(
          structure,
          currentExperiment.isStructureVisible(Number(structure.name))
            ? ALPHA_VISIBLE
            : ALPHA_HIDDEN,
          scene
        );
      }

      const defaultNames = new Set(defaultStructures.map(({ name }) => name));

      // Non-default structures are added/removed based on visibility.
      const desiredIds = currentExperiment.visibleStructures.filter(
        id => !defaultNames.has(id.toString())
      );

      for (const id of desiredIds) {
        if (addedStructures.has(id.toString())) continue;

        const structure = currentAtlas.structureEntityFromId(id);
        if (!structure) continue;

        await addStructure(structure, scene);
        addedStructures.set(structure.name, structure);
      }

      const desiredNames = new Set(desiredIds.map(id => id.toString()));
      for (const [name, structure] of addedStructures) {
        if (desiredNames.has(name)) continue;

        removeStructure(structure, scene);
        addedStructures.delete(name);
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
