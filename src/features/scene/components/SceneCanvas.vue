<script lang="ts" setup>
import {useSceneCanvas} from '../composable/useSceneCanvas'

useSceneCanvas()
</script>

<template>
  <canvas ref="canvas" height="500" width="500" />
</template>
<style scoped>
canvas {
  border: 5px solid royalblue;
}
</style>
