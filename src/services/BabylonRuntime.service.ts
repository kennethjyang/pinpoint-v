/**
 * @fileOverview Service for anything that goes through the BabylonJS graphics runtime including 3D graphics and GPU compute.
 */
import {
  ArcRotateCamera,
  GizmoManager,
  HemisphericLight,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
  WebGPUEngine,
} from '@babylonjs/core'

class BabylonRuntimeService {
  /**
   * Core engine of the runtime.
   * @private
   */
  private engine: WebGPUEngine | null = null

  /**
   * 3D scene on this engine.
   * @private
   */
  private scene: Scene | null = null

  /**
   * Camera in the scene.
   * @private
   */
  private camera: ArcRotateCamera | null = null

  /**
   * Gizmo manager instance.
   * @private
   */
  private gizmoManager: GizmoManager | null = null

  /**
   * Attach a main canvas and initialize BabylonJS engine and scene.
   * @param canvas Main canvas element to display 3D graphics.
   */
  async init(canvas: HTMLCanvasElement) {
    // Initialize engine.
    this.engine = new WebGPUEngine(canvas)
    this.engine.compatibilityMode = false
    await this.engine.initAsync()

    // Attach to scene.
    this.scene = new Scene(this.engine)

    // Attach camera.
    this.camera = new ArcRotateCamera(
      'MainCamera',
      -Math.PI / 2,
      Math.PI / 4,
      10,
      Vector3.Zero(),
      this.scene,
    )
    this.camera.attachControl(canvas, true)

    // Attach gizmo manager.
    this.gizmoManager = new GizmoManager(this.scene)
    this.gizmoManager.positionGizmoEnabled = true
    this.gizmoManager.rotationGizmoEnabled = true

    // Add lights.
    new HemisphericLight('MainLight', Vector3.Up(), this.scene)

    // Build a demo scene.
    const probeMesh = MeshBuilder.CreateBox('ProbeMesh', { height: 2 }, this.scene)
    probeMesh.setAbsolutePosition(Vector3.Up())
    const probeMover = new TransformNode('ProbeTip', this.scene)
    probeMover.addChild(probeMesh)
    this.gizmoManager.attachToNode(probeMover)

    // Begin render loop.
    this.engine.runRenderLoop(() => {
      this.scene!.render()
    })
  }
}

// Singleton instance of runtime.
export const babylonRuntimeService = new BabylonRuntimeService()
