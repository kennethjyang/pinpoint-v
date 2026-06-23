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
  private _engine: WebGPUEngine | null = null

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
   * 3D scene on this engine.
   * @private
   */
  private _scene: Scene | null = null

  /**
   * Initialization promise handler.
   * @private
   */
  private _initDeferred = Promise.withResolvers<void>()

  /**
   * Initialized promise.
   */
  public readonly whenReady = this._initDeferred.promise

  get engine() {
    if (!this._engine)
      throw new Error('Babylon runtime has not been initialized yet! No engine available.')
    return this._engine
  }

  get scene() {
    if (!this._scene)
      throw new Error('Babylon runtime has not been initialized yet! No scene available.')
    return this._scene
  }

  /**
   * Attach a main canvas and initialize BabylonJS engine and scene.
   * @param canvas Main canvas element to display 3D graphics.
   */
  async init(canvas: HTMLCanvasElement) {
    // Initialize engine.
    this._engine = new WebGPUEngine(canvas)
    this._engine.compatibilityMode = false
    await this._engine.initAsync()

    // Attach to scene.
    this._scene = new Scene(this._engine)

    // Attach camera.
    this.camera = new ArcRotateCamera(
      'MainCamera',
      -Math.PI / 2,
      Math.PI / 4,
      10,
      Vector3.Zero(),
      this._scene,
    )
    this.camera.attachControl(canvas, true)

    // Attach gizmo manager.
    this.gizmoManager = new GizmoManager(this._scene)
    this.gizmoManager.positionGizmoEnabled = true
    this.gizmoManager.rotationGizmoEnabled = true

    // Add lights.
    new HemisphericLight('MainLight', Vector3.Up(), this._scene)

    // Build a demo scene.
    const probeMesh = MeshBuilder.CreateBox('ProbeMesh', { height: 2 }, this._scene)
    probeMesh.setAbsolutePosition(Vector3.Up())
    const probeMover = new TransformNode('ProbeTip', this._scene)
    probeMover.addChild(probeMesh)
    this.gizmoManager.attachToNode(probeMover)

    // Begin render loop.
    this._engine.runRenderLoop(() => {
      this._scene!.render()
    })

    // Mark runtime as ready.
    this._initDeferred.resolve()
  }
}

// Singleton instance of runtime.
export const babylonRuntimeService = new BabylonRuntimeService()
