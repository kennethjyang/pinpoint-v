<script setup lang="ts">
import {onMounted, useTemplateRef} from 'vue'
import {createScene} from '@/scenes/MyFirstScene.ts'

const bjsCanvas = useTemplateRef<HTMLCanvasElement | null>("bjs-canvas")
onMounted(() => {
  if (bjsCanvas.value) {
    createScene(bjsCanvas.value)
  }
})
</script>

<template>
  <canvas ref="bjs-canvas" width="500" height="500"/>
</template>
