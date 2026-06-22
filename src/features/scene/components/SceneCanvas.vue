<script lang="ts" setup>
import { onMounted, useTemplateRef } from 'vue'
import { babylonRuntimeService } from '@/services/BabylonRuntimeService.js'

const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

onMounted(() => {
  // Exit if no canvas.
  if (!canvas.value) throw new Error('BabylonJS canvas not found in DOM!')

  // Initialize Babylon Runtime.
  babylonRuntimeService.init(canvas.value)
})
</script>

<template>
  <canvas ref="canvas" height="500" width="500" />
</template>
<style scoped>
canvas {
  border: 5px solid royalblue;
}
</style>
