<script setup lang="ts">
import {onMounted, useTemplateRef} from 'vue'
import {createScene} from '@/scenes/MyFirstScene.ts'

const emit = defineEmits<{
  fps: [fps: string]
}>()

const bjsCanvas = useTemplateRef<HTMLCanvasElement>('bjs-canvas')
const sliceCanvas = useTemplateRef<HTMLCanvasElement>('slice-canvas')
onMounted(() => {
  if (bjsCanvas.value && sliceCanvas.value) {
    createScene(bjsCanvas.value, sliceCanvas.value, (fps: string) => {
      emit('fps', fps)
    })
  }
})
</script>

<template>
  <canvas ref="bjs-canvas" height="500" style="border: 5px solid black;" width="500"/>
  <canvas ref="slice-canvas" height="500" style="border: 5px solid black;" width="500" />
</template>
