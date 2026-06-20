import {
  ArcRotateCamera,
  Engine,
  GizmoManager,
  HemisphericLight,
  MeshBuilder,
  RawTexture,
  RawTexture3D,
  Scene,
  Texture,
  TransformNode,
  Vector3,
  WebGPUEngine,
} from '@babylonjs/core'

interface AnnotationChunkInfo {
  /**
   * Number of entries in the AP dimension.
   */
  APDimension: number

  /**
   * Number of entries in the ML dimension.
   */
  MLDimension: number

  /**
   * Number of entries in the DV dimension.
   */
  DVDimension: number

  /**
   * Lowest APMLDV coordinate in the chunk.
   */
  startCoordinate: Vector3

  /**
   * Highest APMLDV coordinate in the chunk.
   */
  endCoordinate: Vector3

  /**
   * Flattened volume data in ML, AP, DV order (X, Y, Z). len(data) == AP * ML * DV Dimensions
   */
  data: Uint32Array
}

interface LutInfo {
  /**
   * Number of entries in the LUT.
   */
  entries: number

  /**
   * LUT data in RGB order. len(data) == entries * 3.
   */
  data: Uint8Array
}

interface SliceParams {
  /**
   * Center of the slice as APMLDV coordinate.
   */
  center: Vector3

  /**
   * Up vector along the axis of the probe.
   */
  up: Vector3

  /**
   * Right vector local to the probe.
   */
  right: Vector3
}

const createScene = async (canvas: HTMLCanvasElement, fpsCallback: (fps: string) => void) => {
  // Initialize Babylon engine and scene.
  const engine = new WebGPUEngine(canvas)
  await engine.initAsync()
  const scene = new Scene(engine)

  // Init orbiting camera.
  const camera = new ArcRotateCamera(
    'MainCamera',
    -Math.PI / 2,
    Math.PI / 4,
    10,
    Vector3.Zero(),
    scene,
  )
  camera.attachControl(canvas, true)

  // Init light.
  new HemisphericLight('MainLight', Vector3.Up(), scene)

  // Init gizmo manager.
  const gizmoManager = new GizmoManager(scene)
  gizmoManager.positionGizmoEnabled = true
  gizmoManager.rotationGizmoEnabled = true
  gizmoManager.usePointerToAttachGizmos = false

  // Add a "probe" and attach gizmo to tip.
  const probeMesh = MeshBuilder.CreateBox('ProbeMesh', { height: 2 }, scene)
  probeMesh.setAbsolutePosition(Vector3.Up())
  const probeMover = new TransformNode('ProbeTip', scene)
  probeMover.addChild(probeMesh)
  gizmoManager.attachToNode(probeMover)

  // Build annotation chunk texture.
  const annotationChunkData = new Uint32Array([0, 0, 1, 1, 1, 2, 1, 0, 2])
  const annotationChunkTexture = new RawTexture3D(
    annotationChunkData,
    2,
    2,
    2,
    Engine.TEXTUREFORMAT_RED_INTEGER,
    scene,
    false,
    false,
    Texture.NEAREST_NEAREST,
    Engine.TEXTURETYPE_UNSIGNED_INTEGER,
  )

  // Build LUT texture.
  const lutData = new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
  ])
  const lutTexture = new RawTexture(
    lutData,
    3,
    1,
    Engine.TEXTUREFORMAT_RGBA,
    scene,
    false,
    false,
    Texture.NEAREST_NEAREST,
    Engine.TEXTURETYPE_UNSIGNED_BYTE,
  )

  // Engine render loop.
  engine.runRenderLoop(() => {
    // Render the scene.
    scene.render()

    // Update the FPS.
    if (fpsCallback) {
      fpsCallback(engine.getFps().toFixed())
    }
  })
}

export { createScene }
