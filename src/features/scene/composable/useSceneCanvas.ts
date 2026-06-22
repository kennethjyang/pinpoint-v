import {onMounted, useTemplateRef} from 'vue'
import {babylonRuntimeService} from '@/services/BabylonRuntime.service.ts'

export function useSceneCanvas() {
  const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

  onMounted(async () => {
    // Exit if no canvas.
    if (!canvas.value) return

    // Initialize Babylon Runtime.
    await babylonRuntimeService.init(canvas.value)
  })
}
