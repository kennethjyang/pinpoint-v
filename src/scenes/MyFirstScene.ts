import {
  ArcRotateCamera,
  Engine,
  GizmoManager,
  HemisphericLight,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'

const createScene = (canvas: HTMLCanvasElement, fpsCallback: (fps: string) => void) => {
  const engine = new Engine(canvas)
  const scene = new Scene(engine)

  const camera = new ArcRotateCamera(
    'MainCamera',
    -Math.PI / 2,
    Math.PI / 4,
    10,
    Vector3.Zero(),
    scene,
  )
  camera.attachControl(canvas, true)

  new HemisphericLight('MainLight', Vector3.Up(), scene)

  const gizmoManager = new GizmoManager(scene)
  gizmoManager.positionGizmoEnabled = true
  gizmoManager.rotationGizmoEnabled = true
  gizmoManager.usePointerToAttachGizmos = false

  const probeMesh = MeshBuilder.CreateBox('ProbeMesh', { height: 2 }, scene)
  probeMesh.setAbsolutePosition(Vector3.Up())
  const probeMover = new TransformNode('ProbeMover', scene)
  probeMover.addChild(probeMesh)
  gizmoManager.attachToNode(probeMover)

  engine.runRenderLoop(() => {
    scene.render()

    if (fpsCallback) {
      fpsCallback(engine.getFps().toFixed())
    }
  })
}

export { createScene }
