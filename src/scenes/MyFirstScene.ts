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
  ShaderStore,
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
  const lutData = new Uint8Array([0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])
  const lutTexture = new RawTexture(
    lutData,
    4,
    1,
    Engine.TEXTUREFORMAT_RGBA_INTEGER,
    scene,
    false,
    false,
    Texture.NEAREST_NEAREST,
    Engine.TEXTURETYPE_UNSIGNED_BYTE,
  )

  // Build input parameter buffer.
  const sliceParameterBuffer = new UniformBuffer(engine, undefined, true, 'parameters')
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
    engine,
    OUTPUT_SIZE * OUTPUT_SIZE * 4,
    Constants.BUFFER_CREATIONFLAG_READWRITE,
  )
  const sliceColorBuffer = new StorageBuffer(
    engine,
    OUTPUT_SIZE * OUTPUT_SIZE * 4,
    Constants.BUFFER_CREATIONFLAG_READWRITE,
  )

  // Store shader.
  ShaderStore.ShadersStoreWGSL['sliceComputeShader'] = `
  // Input paramters. In world space mm.
  struct Parameters {
      centerAndHalfSize: vec4f,
      rightAndChunkResolution: vec4f,
      up: vec4f,
      chunkStartCoordinate: vec4f,
  }

    // Input paramters.
    @group(0) @binding(0) var<uniform> parameters: Parameters;

    // Atlas annotation volume chunk.
    @group(0) @binding(1) var annotationChunk: texture_3d<u32>;

    // Annotation IDs to color LUT.
    @group(0) @binding(2) var lut: texture_2d<u32>;

    // Slice IDs.
    @group(0) @binding(3) var<storage, read_write> idOut: array<u32>;

    // Slice colors (8-bit RGBA).
    @group(0) @binding(4) var<storage, read_write> colorOut: array<u32>;

    @compute @workgroup_size(8, 8, 1)
  fn main(@builtin(global_invocation_id) globalThreadId: vec3u) {
      // Extract output pixel coordinate.
      let outputSideLength = u32(sqrt(f32(arrayLength(&colorOut))));
      let pixelX = globalThreadId.x;
      let pixelY = globalThreadId.y;
      let pixelIndex = pixelY * outputSideLength + pixelX;
      if pixelX >= outputSideLength || pixelY >= outputSideLength { return; }

      // Unpack parameters.
      let center = parameters.centerAndHalfSize.xyz;
      let halfSize = parameters.centerAndHalfSize.w;
      let right = parameters.rightAndChunkResolution.xyz;
      let chunkResolution = parameters.rightAndChunkResolution.w;
      let chunkHalfResolution = chunkResolution * 0.5;
      let up = parameters.up.xyz;
      let chunkStartCoordinate = parameters.chunkStartCoordinate.xyz;

      // Compute world space coordiante of pixel.
      let normalizedS = (f32(pixelX) + 0.5) / f32(outputSideLength) * 2.0 - 1.0;
      let normalizedT = (f32(pixelY) + 0.5) / f32(outputSideLength) * 2.0 - 1.0;
      let worldPosition = center + normalizedS * right * halfSize + normalizedT * up * halfSize;

      // Extract chunk dimensions (used later).
      let chunkDimensions = textureDimensions(annotationChunk);
      let chunkMinBounds = chunkStartCoordinate - chunkHalfResolution;
      let chunkMaxBounds = chunkStartCoordinate + vec3f(chunkDimensions) * chunkResolution - chunkHalfResolution;

      // Exit if position out of chunk bounds.
      if any(worldPosition < chunkMinBounds) || any(worldPosition >= chunkMaxBounds) {
          idOut[pixelIndex] = 0u;
          colorOut[pixelIndex] = 0u;
          return;
      }

      // Compute annotation index in chunk.
      let chunkLocalPosition = worldPosition - chunkStartCoordinate;
      let annotationChunkIndex = vec3i(round(chunkLocalPosition / chunkResolution));

      // Verify bounds and load ID (default to empty).
      var structureId: u32 = 0u;
      if all(annotationChunkIndex >= vec3i(0)) && all(annotationChunkIndex < vec3i(chunkDimensions)) {
          structureId = textureLoad(annotationChunk, annotationChunkIndex, 0).r;
      }

      // Write ID to ID output.
      idOut[pixelIndex] = structureId;

      // Look up color in LUT.
      let lutIndex = select(0u, structureId, structureId < textureDimensions(lut).x);
      let lutColor = textureLoad(lut, vec2i(i32(lutIndex), 0), 0);

      // Write to color output (repack expanded load).
      colorOut[pixelIndex] = lutColor.r | (lutColor.g << 8u) | (lutColor.b << 16u) | (lutColor.a << 24u);
  }
  `

  // Declare compute shader and bind data.
  const sliceComputeShader = new ComputeShader('sliceComputeShader', engine, 'slice', {
    bindingsMapping: {
      parameters: { group: 0, binding: 0 },
      annotationChunk: { group: 0, binding: 1 },
      lut: { group: 0, binding: 2 },
      idOut: { group: 0, binding: 3 },
      colorOut: { group: 0, binding: 4 },
    },
  })
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
      sliceCanvas
        .getContext('2d')
        ?.putImageData(new ImageData(pixels, OUTPUT_SIZE, OUTPUT_SIZE), 0, 0)
    })
  })

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
