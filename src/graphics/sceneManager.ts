/**
 * @fileOverview Handles all 3D graphics and routes interactions with it.
 */
import {
  ArcRotateCamera,
  GizmoManager,
  HemisphericLight,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
  type WebGPUEngine,
} from '@babylonjs/core'

export class SceneManager {
  /**
   * 3D scene component.
   */
  public readonly scene: Scene

  /**
   * Camera in the scene.
   * @private
   */
  private readonly camera: ArcRotateCamera

  /**
   * Gizmo manager for elements in the scene.
   * @private
   */
  private readonly gizmoManager: GizmoManager

  /**
   * Build the manager and scene from an engine.
   * @param engine Engine instance to build scene on.
   */
  constructor(engine: WebGPUEngine) {
    // Save access to scene
    this.scene = new Scene(engine)

    // Initialize camera.
    this.camera = new ArcRotateCamera(
      'MainCamera',
      -Math.PI / 2,
      Math.PI / 4,
      10,
      Vector3.Zero(),
      this.scene,
    )
    this.camera.attachControl(engine.getRenderingCanvas(), true)

    // Initialize gizmo manager.
    this.gizmoManager = new GizmoManager(this.scene)
    this.gizmoManager.positionGizmoEnabled = true
    this.gizmoManager.rotationGizmoEnabled = true

    // Build default scene.
    new HemisphericLight('MainLight', Vector3.Up(), this.scene)

    const probeMesh = MeshBuilder.CreateBox('ProbeMesh', { height: 2 }, this.scene)
    probeMesh.setAbsolutePosition(Vector3.Up())
    const probeMover = new TransformNode('ProbeTip', this.scene)
    probeMover.addChild(probeMesh)
    this.gizmoManager.attachToNode(probeMover)
  }
}
