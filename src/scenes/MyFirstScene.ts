import {
  ArcRotateCamera,
  ComputeShader,
  Constants,
  Engine,
  GizmoManager,
  HemisphericLight,
  MeshBuilder,
  RawTexture,
  RawTexture3D,
  Scene,
  StorageBuffer,
  Texture,
  TransformNode,
  UniformBuffer,
  Vector3,
  WebGPUEngine,
} from '@babylonjs/core'

const createScene = async (
  canvas: HTMLCanvasElement,
  sliceCanvas: HTMLCanvasElement,
  fpsCallback: (fps: string) => void,
) => {
  // Initialize WebGPU Babylon engine and scene.
  const engine = new WebGPUEngine(canvas)
  engine.compatibilityMode = false
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
  const annotationChunkData = new Uint32Array([
    1, 2, 0, 0, 1, 2, 2, 0, 1, 1, 0, 2, 1, 0, 0, 2, 0, 1, 2, 2, 0, 1, 1, 0, 2, 2, 1, 1, 0, 0, 2, 1,
    2, 0, 1, 2, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 1, 0, 0, 2, 1, 1, 2, 0, 0, 1, 2, 2, 1, 0, 0, 2, 1, 2,
  ])
  const annotationChunkTexture = new RawTexture3D(
    annotationChunkData,
    4,
    4,
    4,
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

  // Build input parameter buffer.
  const sliceParameterBuffer = new UniformBuffer(engine, undefined, true, 'parameters')
  sliceParameterBuffer.addUniform('center', 3)
  sliceParameterBuffer.addUniform('size', 1)
  sliceParameterBuffer.addUniform('up', 3)
  sliceParameterBuffer.addUniform('resolution', 1)
  sliceParameterBuffer.addUniform('right', 3)
  sliceParameterBuffer.addUniform('startCoordinate', 3)
  sliceParameterBuffer.addUniform('endCoordinate', 3)

  sliceParameterBuffer.updateFloat3('center', 1.5, 1.5, 1.5)
  sliceParameterBuffer.updateUInt('size', 2)
  sliceParameterBuffer.updateFloat3('up', 0, 0, 1)
  sliceParameterBuffer.updateUInt('resolution', 100)
  sliceParameterBuffer.updateFloat3('right', 1, 0, 0)
  sliceParameterBuffer.updateFloat3('startCoordinate', 0, 0, 0)
  sliceParameterBuffer.updateFloat3('endCoordinate', 400, 400, 400)

  sliceParameterBuffer.update()

  // Declare output buffers.
  const sliceColorBuffer = new StorageBuffer(
    engine,
    64 * 4,
    Constants.BUFFER_CREATIONFLAG_READWRITE,
  )
  const sliceIdBuffer = new StorageBuffer(engine, 64 * 4, Constants.BUFFER_CREATIONFLAG_READWRITE)

  // Declare compute shader and bind data.
  const sliceComputeShader = new ComputeShader('sliceComputeShader', engine, 'slice', {
    bindingsMapping: {
      parameters: { group: 0, binding: 0 },
      annotationChunk: { group: 0, binding: 1 },
      lut: { group: 0, binding: 2 },
      colorOut: { group: 0, binding: 3 },
      idOut: { group: 0, binding: 4 },
    },
  })
  sliceComputeShader.setUniformBuffer('parameters', sliceParameterBuffer)
  sliceComputeShader.setTexture('annotationChunk', annotationChunkTexture, false)
  sliceComputeShader.setTexture('lut', lutTexture, false)
  sliceComputeShader.setStorageBuffer('colorOut', sliceColorBuffer)
  sliceComputeShader.setStorageBuffer('idOut', sliceIdBuffer)

  // Configure render canvas.
  const sliceCanvasOffscreen = sliceCanvas.transferControlToOffscreen()
  // TODO: Spawn render worker.

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
