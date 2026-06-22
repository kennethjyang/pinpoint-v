/**
 * @fileOverview Handler for anything that goes through the graphics engine view including 3D graphics and GPU compute.
 */
import {WebGPUEngine} from '@babylonjs/core'
import {SceneManager} from '@/graphics/sceneManager.ts'

class GraphicsRuntimeManager {
  /**
   * Core engine of the runtime.
   * @private
   */
  private engine: WebGPUEngine | null = null

  /**
   * 3D scene manager on this runtime.
   * @private
   */
  private sceneManager: SceneManager | null = null

  /**
   * Attach a main canvas and initialize graphics engine and scene.
   * @param canvas Main canvas element to display 3D graphics.
   */
  async attachMainCanvas(canvas: HTMLCanvasElement) {
    // Initialize engine.
    this.engine = new WebGPUEngine(canvas)
    this.engine.compatibilityMode = false
    await this.engine.initAsync()

    // Attach to scene.
    this.sceneManager = new SceneManager(this.engine)

    // Begin render loop.
    this.engine.runRenderLoop(() => {
      this.sceneManager?.scene.render()
    })
  }
}

// Singleton instance of runtime.
export const graphicsRuntimeManager = new GraphicsRuntimeManager()
