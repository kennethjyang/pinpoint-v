<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef } from 'vue'
import { babylonRuntimeService } from '@/services/babylon-runtime.service.js'
import {
  ComputeShader,
  Constants,
  Engine,
  Observer,
  RawTexture,
  RawTexture3D,
  type Scene,
  StorageBuffer,
  Texture,
  UniformBuffer,
} from '@babylonjs/core'
import {
  INPLANE_SLICE_COMPUTE_SHADER_NAME,
  INPLANE_SLICE_SHADER_PATH,
} from '../shaders/inplane-slice-compute.shader'
import { FetchStore, open, get, slice } from 'zarrita'

// Components.
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const worker = new Worker(new URL('../workers/inplane-slice-render.worker.ts', import.meta.url), {
  type: 'module',
})
let computeShader: ComputeShader
let renderObservable: Observer<Scene> | null = null

// Atlas data setup.
const store = new FetchStore('http://localhost:3000/allen_mouse/10.0.zarr')
const OUTPUT_SIZE = 500
const WORKGROUPS = Math.ceil(OUTPUT_SIZE / 8)

// Shader inputs.
let sliceParameterBuffer: UniformBuffer | null = null
let annotationChunkTexture: RawTexture3D | null = null
let lutTexture: RawTexture | null = null
let idBuffer: StorageBuffer | null = null
let colorBuffer: StorageBuffer | null = null

onMounted(async () => {
  if (!canvas.value) throw new Error('Inplane slice canvas not found in DOM!')

  // Load atlas data. APMLDV
  const array = await open(store, { kind: 'array' })
  if (!array.is('uint32')) throw new Error('Annotation volume is not the expected type!')
  const region = await get(array, [slice(540, 541), slice(320, 800), slice(0, 800)])
  console.log(region.shape)

  const lutResponse = await fetch('http://localhost:3000/allen_mouse/lut.bin')
  const lutBuffer = await lutResponse.arrayBuffer()
  const lutData = new Uint8Array(lutBuffer)
  console.log(lutData.length)

  await babylonRuntimeService.whenReady

  const caps = babylonRuntimeService.engine.getCaps()
  console.log(caps.maxTextureSize)

  sliceParameterBuffer = new UniformBuffer(
    babylonRuntimeService.engine,
    undefined,
    true,
    'parameters',
  )
  sliceParameterBuffer.addUniform('centerAndHalfSize', 4)
  sliceParameterBuffer.addUniform('rightAndChunkResolution', 4)
  sliceParameterBuffer.addUniform('up', 4)
  sliceParameterBuffer.addUniform('chunkStartCoordinate', 4)

  sliceParameterBuffer.updateFloat4('centerAndHalfSize', 5.4, 5.7, 0, 5)
  sliceParameterBuffer.updateFloat4('rightAndChunkResolution', 0, 1, 0, 0.01)
  sliceParameterBuffer.updateFloat4('up', 0, 0, 1, 0)
  sliceParameterBuffer.updateFloat4('chunkStartCoordinate', 5.4, 3.239, 0, 0)

  sliceParameterBuffer.update()

  annotationChunkTexture = new RawTexture3D(
    region.data,
    region.shape[0]!,
    region.shape[2]!,
    region.shape[1]!,
    Engine.TEXTUREFORMAT_RED_INTEGER,
    babylonRuntimeService.scene,
    false,
    false,
    Texture.NEAREST_NEAREST,
    Engine.TEXTURETYPE_UNSIGNED_INTEGER,
  )

  lutTexture = new RawTexture(
    lutData,
    lutData.length / 4,
    1,
    Engine.TEXTUREFORMAT_RGBA_INTEGER,
    babylonRuntimeService.scene,
    false,
    false,
    Texture.NEAREST_NEAREST,
    Engine.TEXTURETYPE_UNSIGNED_BYTE,
  )

  idBuffer = new StorageBuffer(
    babylonRuntimeService.engine,
    OUTPUT_SIZE * OUTPUT_SIZE * 4,
    Constants.BUFFER_CREATIONFLAG_READWRITE,
  )
  colorBuffer = new StorageBuffer(
    babylonRuntimeService.engine,
    OUTPUT_SIZE * OUTPUT_SIZE * 4,
    Constants.BUFFER_CREATIONFLAG_READWRITE,
  )

  computeShader = new ComputeShader(
    INPLANE_SLICE_COMPUTE_SHADER_NAME,
    babylonRuntimeService.engine,
    INPLANE_SLICE_SHADER_PATH,
    {
      bindingsMapping: {
        parameters: { group: 0, binding: 0 },
        annotationChunk: { group: 0, binding: 1 },
        lut: { group: 0, binding: 2 },
        idOut: { group: 0, binding: 3 },
        colorOut: { group: 0, binding: 4 },
      },
    },
  )
  computeShader.setUniformBuffer('parameters', sliceParameterBuffer)
  computeShader.setTexture('annotationChunk', annotationChunkTexture, false)
  computeShader.setTexture('lut', lutTexture, false)
  computeShader.setStorageBuffer('idOut', idBuffer)
  computeShader.setStorageBuffer('colorOut', colorBuffer)

  // let theta = 0

  const offscreenCanvas = canvas.value.transferControlToOffscreen()
  worker.postMessage({ type: 'init', offscreenCanvas: offscreenCanvas }, [offscreenCanvas])

  renderObservable = babylonRuntimeService.scene.onBeforeRenderObservable.add(() => {
    computeShader.dispatchWhenReady(WORKGROUPS, WORKGROUPS, 1).then(() => {
      colorBuffer?.read().then((colorData) => {
        const buffer = colorData.buffer as ArrayBuffer
        worker.postMessage({ type: 'frame', buffer, size: OUTPUT_SIZE }, [buffer])
      })
    })

    // theta += 0.05
    // sliceParameterBuffer?.updateFloat4(
    //   'centerAndHalfSize',
    //   0.15 + Math.sin(theta) / 10,
    //   0.15,
    //   0.15 + Math.sin(theta) / 10,
    //   0.15,
    // )
    // sliceParameterBuffer?.update()
  })
})

onUnmounted(async () => {
  worker.terminate()

  sliceParameterBuffer?.dispose()
  annotationChunkTexture?.dispose()
  lutTexture?.dispose()
  idBuffer?.dispose()
  colorBuffer?.dispose()

  await babylonRuntimeService.whenReady
  babylonRuntimeService.scene.onBeforeRenderObservable.remove(renderObservable)
})
</script>

<template>
  <canvas ref="canvas" height="500" width="500" />
</template>

<style scoped>
canvas {
  border: 5px solid black;
}
</style>
