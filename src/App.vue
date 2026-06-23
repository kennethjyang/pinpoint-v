<script setup lang="ts">
import { InplaneSliceCanvas } from '@/features/inplane-slice'
import { SceneCanvas } from '@/features/scene'
import { atlasService } from '@/services/AtlasService.ts'

atlasService.getChunk()
</script>

<template>
  <SceneCanvas />
  <InplaneSliceCanvas />
</template>

<style scoped></style>
