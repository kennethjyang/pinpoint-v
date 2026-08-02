import type {
  AnnotationLevel,
  AnnotationVolume
} from "../models/annotation-level.model";
import type { SampleGeometry } from "../models/sample-geometry.model";
import type {
  SampleChunkRequest,
  SamplePlan
} from "../models/sample-plan.model";

/** Preferred ceiling on chunk fetches per sample; not a guarantee. */
const PREFERRED_MAXIMUM_CHUNK_REQUESTS = 24;

/** How much coarser than one sample a level's voxel may be before it's too blurry to prefer. */
const RESOLUTION_TOLERANCE = 1.5;

/** A chunk grid's dorsoventral and mediolateral chunk counts, for packing chunk coordinates into a single key. */
interface ChunkGrid {
  gridDv: number;
  gridMl: number;
}

/** A sample's resolved chunk and its offset within that chunk. */
interface ResolvedVoxel {
  chunkCoordinates: [number, number, number];
  chunkKey: number;
  voxelOffset: number;
}

/**
 * Bucket a geometry's samples by the annotation chunk each one reads from.
 * @param geometry Geometry to sample.
 * @param level Multiscale level to sample from.
 * @param levelIndex Index of `level` within its volume.
 */
export function planSamples(
  geometry: SampleGeometry,
  level: AnnotationLevel,
  levelIndex: number
): SamplePlan {
  const grid = getChunkGrid(level);
  const buckets = new Map<
    number,
    {
      chunkCoordinates: [number, number, number];
      sampleIndices: number[];
      voxelOffsets: number[];
    }
  >();

  forEachSamplePoint(geometry, (index, a, s, r) => {
    const voxel = resolveVoxel(level, grid, a, s, r);
    if (!voxel) return;

    let bucket = buckets.get(voxel.chunkKey);
    if (!bucket) {
      bucket = {
        chunkCoordinates: voxel.chunkCoordinates,
        sampleIndices: [],
        voxelOffsets: []
      };
      buckets.set(voxel.chunkKey, bucket);
    }
    bucket.sampleIndices.push(index);
    bucket.voxelOffsets.push(voxel.voxelOffset);
  });

  const chunkRequests: SampleChunkRequest[] = Array.from(
    buckets.values(),
    bucket => ({
      chunkCoordinates: bucket.chunkCoordinates,
      sampleIndices: Int32Array.from(bucket.sampleIndices),
      voxelOffsets: Int32Array.from(bucket.voxelOffsets)
    })
  );

  return { levelIndex, sampleCount: getSampleCount(geometry), chunkRequests };
}

/**
 * Choose an annotation level for a geometry and plan its samples against it
 * in the same pass, escalating to coarser levels until the plan's chunk count
 * fits the preferred budget (or the coarsest level is reached).
 * @param geometry Geometry to sample.
 * @param volume Annotation volume to plan against.
 */
export function selectSamplePlan(
  geometry: SampleGeometry,
  volume: AnnotationVolume
): SamplePlan {
  if (volume.levels.length === 0) {
    return {
      levelIndex: 0,
      sampleCount: getSampleCount(geometry),
      chunkRequests: []
    };
  }

  const millimetersPerSample = getMillimetersPerSample(geometry);
  let startIndex = 0;
  for (let index = 0; index < volume.levels.length; index++) {
    const level = volume.levels[index]!;
    if (
      Math.min(...level.scaleMillimeters) <=
      RESOLUTION_TOLERANCE * millimetersPerSample
    ) {
      startIndex = index;
    }
  }

  for (let index = startIndex; index < volume.levels.length; index++) {
    const isCoarsestLevel = index === volume.levels.length - 1;
    const plan = planSamples(geometry, volume.levels[index]!, index);
    if (
      isCoarsestLevel ||
      plan.chunkRequests.length <= PREFERRED_MAXIMUM_CHUNK_REQUESTS
    ) {
      return plan;
    }
  }

  const coarsestIndex = volume.levels.length - 1;
  return planSamples(geometry, volume.levels[coarsestIndex]!, coarsestIndex);
}

/**
 * Millimeters spanned by one sample of a geometry, along whichever axis is finer.
 * @param geometry Geometry to measure.
 */
function getMillimetersPerSample(geometry: SampleGeometry): number {
  const stepU = (2 * geometry.halfWidthMillimeters) / geometry.widthPixels;
  const stepV = (2 * geometry.halfHeightMillimeters) / geometry.heightPixels;
  return Math.min(stepU, stepV);
}

/**
 * Total number of samples a geometry produces.
 * @param geometry Geometry to measure.
 */
function getSampleCount(geometry: SampleGeometry): number {
  return geometry.widthPixels * geometry.heightPixels;
}

/**
 * Visit every sample point of a geometry in atlas ASR millimeters.
 *
 * Row 0 is the +up edge and samples are visited row-major - the same
 * convention the slice canvas's SVG overlay must mirror.
 * @param geometry Geometry to walk.
 * @param visit Callback invoked with each sample's output index and ASR coordinates.
 */
function forEachSamplePoint(
  geometry: SampleGeometry,
  visit: (index: number, a: number, s: number, r: number) => void
): void {
  const {
    centerMillimeters,
    rightMillimeters,
    upMillimeters,
    halfWidthMillimeters,
    halfHeightMillimeters,
    widthPixels,
    heightPixels
  } = geometry;
  const stepU = (2 * halfWidthMillimeters) / widthPixels;
  const stepV = (2 * halfHeightMillimeters) / heightPixels;

  for (let row = 0; row < heightPixels; row++) {
    const v = halfHeightMillimeters - (row + 0.5) * stepV;
    for (let column = 0; column < widthPixels; column++) {
      const u = -halfWidthMillimeters + (column + 0.5) * stepU;
      visit(
        row * widthPixels + column,
        centerMillimeters[0] + rightMillimeters[0] * u + upMillimeters[0] * v,
        centerMillimeters[1] + rightMillimeters[1] * u + upMillimeters[1] * v,
        centerMillimeters[2] + rightMillimeters[2] * u + upMillimeters[2] * v
      );
    }
  }
}

/**
 * Chunk grid dimensions of a level, for packing chunk coordinates into a
 * single lookup key.
 * @param level Level to derive the grid from.
 */
function getChunkGrid(level: AnnotationLevel): ChunkGrid {
  const [, dvShape, mlShape] = level.shapeVoxels;
  const [, dvChunk, mlChunk] = level.chunkShapeVoxels;
  return {
    gridDv: Math.ceil(dvShape / dvChunk),
    gridMl: Math.ceil(mlShape / mlChunk)
  };
}

/**
 * Resolve an ASR millimeter point to its chunk and voxel offset within that
 * chunk, or null when the point falls outside the level's volume.
 * @param level Level to resolve against.
 * @param grid Level's chunk grid dimensions.
 * @param a Anterior-posterior coordinate, in mm.
 * @param s Superior-inferior coordinate, in mm.
 * @param r Right-left coordinate, in mm.
 */
function resolveVoxel(
  level: AnnotationLevel,
  grid: ChunkGrid,
  a: number,
  s: number,
  r: number
): ResolvedVoxel | null {
  const [translationA, translationS, translationR] =
    level.translationMillimeters;
  const [scaleA, scaleS, scaleR] = level.scaleMillimeters;
  const [shapeA, shapeS, shapeR] = level.shapeVoxels;
  const [chunkA, chunkS, chunkR] = level.chunkShapeVoxels;

  // Math.floor, not `| 0`: `| 0` truncates toward zero and is wrong for
  // negative coordinates just outside the volume.
  const voxelA = Math.floor((a - translationA) / scaleA);
  const voxelS = Math.floor((s - translationS) / scaleS);
  const voxelR = Math.floor((r - translationR) / scaleR);
  if (
    voxelA < 0 ||
    voxelS < 0 ||
    voxelR < 0 ||
    voxelA >= shapeA ||
    voxelS >= shapeS ||
    voxelR >= shapeR
  ) {
    return null;
  }

  const chunkCoordinateA = Math.floor(voxelA / chunkA);
  const chunkCoordinateS = Math.floor(voxelS / chunkS);
  const chunkCoordinateR = Math.floor(voxelR / chunkR);
  const chunkKey =
    (chunkCoordinateA * grid.gridDv + chunkCoordinateS) * grid.gridMl +
    chunkCoordinateR;
  const voxelOffset =
    ((voxelA - chunkCoordinateA * chunkA) * chunkS +
      (voxelS - chunkCoordinateS * chunkS)) *
      chunkR +
    (voxelR - chunkCoordinateR * chunkR);

  return {
    chunkCoordinates: [chunkCoordinateA, chunkCoordinateS, chunkCoordinateR],
    chunkKey,
    voxelOffset
  };
}
