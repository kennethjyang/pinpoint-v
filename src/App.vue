<script setup lang="ts">
import {ref} from 'vue'
import SceneCanvas from '@/components/SceneCanvas.vue'

const fps = ref('0')

function updateFps(newFps: string) {
  fps.value = newFps
}
</script>

<template>
  <h1>You did it!</h1>
  <p>
    Visit <a href="https://vuejs.org/" target="_blank" rel="noopener">vuejs.org</a> to read the
    documentation
  </p>
  <p>{{ fps }}</p>
  <SceneCanvas @fps="updateFps" />
</template>

<style scoped></style>
