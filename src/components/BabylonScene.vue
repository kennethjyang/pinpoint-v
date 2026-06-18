<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import { createScene } from '@/scenes/MyFirstScene.ts'

const emit = defineEmits<{
  fps: [fps: string]
}>()

const bjsCanvas = useTemplateRef<HTMLCanvasElement | null>('bjs-canvas')
onMounted(() => {
  if (bjsCanvas.value) {
    createScene(bjsCanvas.value, (fps: string) => {
      emit('fps', fps)
    })
  }
})
</script>

<template>
  <canvas ref="bjs-canvas" height="500" width="500" />
</template>
