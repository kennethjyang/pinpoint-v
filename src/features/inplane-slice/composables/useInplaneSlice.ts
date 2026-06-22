import {onMounted, useTemplateRef} from 'vue'
import {
  ComputeShader,
  Constants,
  Engine,
  RawTexture,
  RawTexture3D,
  StorageBuffer,
  Texture,
  UniformBuffer,
} from '@babylonjs/core'
import {babylonRuntimeService} from '@/services/BabylonRuntimeService.ts'
import {
  INPLANE_SLICE_COMPUTE_SHADER_NAME,
  INPLANE_SLICE_SHADER_PATH
} from '@/features/inplane-slice/shaders/inplaneSliceComputeShader.ts'

export function useInplaneSlice() {
  const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

  onMounted(async () => {
    // Exit if no canvas.
    if (!canvas.value) return

    await babylonRuntimeService.whenReady

    // Build annotation chunk texture.
    const annotationChunkData = new Uint32Array([
      1, 2, 0, 0, 1, 2, 2, 0, 1, 1, 0, 2, 1, 0, 0, 2, 0, 1, 2, 2, 0, 1, 1, 0, 2, 2, 1, 1, 0, 0, 2,
      1, 2, 0, 1, 2, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 1, 0, 0, 2, 1, 1, 2, 0, 0, 1, 2, 2, 1, 0, 0, 2,
      1, 2,
    ])
    const annotationChunkTexture = new RawTexture3D(
      annotationChunkData,
      4,
      4,
      4,
      Engine.TEXTUREFORMAT_RED_INTEGER,
      babylonRuntimeService.scene,
      false,
      false,
      Texture.NEAREST_NEAREST,
      Engine.TEXTURETYPE_UNSIGNED_INTEGER,
    )

    // Build LUT texture.
    const lutData = new Uint8Array([0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])
    const lutTexture = new RawTexture(
      lutData,
      4,
      1,
      Engine.TEXTUREFORMAT_RGBA_INTEGER,
      babylonRuntimeService.scene,
      false,
      false,
      Texture.NEAREST_NEAREST,
      Engine.TEXTURETYPE_UNSIGNED_BYTE,
    )

    // Build input parameter buffer.
    const sliceParameterBuffer = new UniformBuffer(
      babylonRuntimeService.engine,
      undefined,
      true,
      'parameters',
    )
    sliceParameterBuffer.addUniform('centerAndHalfSize', 4)
    sliceParameterBuffer.addUniform('rightAndChunkResolution', 4)
    sliceParameterBuffer.addUniform('up', 4)
    sliceParameterBuffer.addUniform('chunkStartCoordinate', 4)

    sliceParameterBuffer.updateFloat4('centerAndHalfSize', 0.15, 0.15, 0.15, 0.15)
    sliceParameterBuffer.updateFloat4('rightAndChunkResolution', Math.sqrt(3) / 2, 0, -1 / 2, 0.1)
    sliceParameterBuffer.updateFloat4('up', 1 / 2, 0, Math.sqrt(3) / 2, 0)
    sliceParameterBuffer.updateFloat4('chunkStartCoordinate', 0, 0, 0, 0)

    sliceParameterBuffer.update()

    // Declare output buffers.
    const OUTPUT_SIZE = 500
    const sliceIdBuffer = new StorageBuffer(
      babylonRuntimeService.engine,
      OUTPUT_SIZE * OUTPUT_SIZE * 4,
      Constants.BUFFER_CREATIONFLAG_READWRITE,
    )
    const sliceColorBuffer = new StorageBuffer(
      babylonRuntimeService.engine,
      OUTPUT_SIZE * OUTPUT_SIZE * 4,
      Constants.BUFFER_CREATIONFLAG_READWRITE,
    )

    // Declare compute shader and bind data.
    const sliceComputeShader = new ComputeShader(
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
    sliceComputeShader.setUniformBuffer('parameters', sliceParameterBuffer)
    sliceComputeShader.setTexture('annotationChunk', annotationChunkTexture, false)
    sliceComputeShader.setTexture('lut', lutTexture, false)
    sliceComputeShader.setStorageBuffer('idOut', sliceIdBuffer)
    sliceComputeShader.setStorageBuffer('colorOut', sliceColorBuffer)

    // Dispatch with workgroups.
    const WORKGROUPS = Math.ceil(OUTPUT_SIZE / 8)
    sliceComputeShader.dispatchWhenReady(WORKGROUPS, WORKGROUPS, 1).then(() => {
      sliceColorBuffer.read().then((colorData) => {
        const pixels = new Uint8ClampedArray(colorData.buffer as ArrayBuffer)
        canvas
          .value!.getContext('2d')
          ?.putImageData(new ImageData(pixels, OUTPUT_SIZE, OUTPUT_SIZE), 0, 0)
      })
    })
  })
}
