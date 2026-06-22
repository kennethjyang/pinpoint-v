<script lang="ts" setup>
import {useInplaneSlice} from '../composable/useInplaneSlice'

useInplaneSlice()
</script>

<template>
  <canvas ref="canvas" height="500" width="500" />
</template>

<style scoped>
canvas {
  border: 5px solid black;
}
</style>
