<script lang="ts" setup>
import {useInplaneSlice} from '@/features/inplane-slice/composables/useInplaneSlice'

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
