import {ShaderStore} from '@babylonjs/core'

export const INPLANE_SLICE_SHADER_PATH = 'inplaneSlice'
export const INPLANE_SLICE_COMPUTE_SHADER_NAME = `${INPLANE_SLICE_SHADER_PATH}ComputeShader`

if (!ShaderStore.ShadersStoreWGSL[INPLANE_SLICE_COMPUTE_SHADER_NAME]) {
  ShaderStore.ShadersStoreWGSL[INPLANE_SLICE_COMPUTE_SHADER_NAME] = `
    // Input parameters. In world space mm.
    struct Parameters {
        centerAndHalfSize: vec4f,
        rightAndChunkResolution: vec4f,
        up: vec4f,
        chunkStartCoordinate: vec4f,
    }

      // Input parameters.
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

        // Compute world space coordinate of pixel.
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
}
