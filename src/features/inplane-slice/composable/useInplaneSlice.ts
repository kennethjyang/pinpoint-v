import {onMounted, useTemplateRef} from 'vue'

export function useInplaneSlice() {
  const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

  onMounted(async () => {
    // Exit if no canvas.
    if (!canvas.value) return

    // Compute slice.
  })
}
