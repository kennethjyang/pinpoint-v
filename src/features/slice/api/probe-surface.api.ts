import type { AnnotationLevel } from "../models/annotation-level.model";
import type { SampleGeometry } from "../models/sample-geometry.model";
import type { ProbeFrame } from "./probe-frame.api";

/** Samples one ray geometry, resolving dense annotation values, or null when unavailable. */
export type RaySampler = (
  geometry: SampleGeometry
) => Promise<Uint32Array | null>;

/** Tip targets that put a probe on the brain surface, in atlas ASR mm. */
export interface ProbeSurfaceTargets {
  /** Target when the probe already crosses brain along its depth axis, else null. */
  insideMillimeters: [number, number, number] | null;
  /** Target moving forward along the probe's reversed depth axis, else null. */
  axisMillimeters: [number, number, number] | null;
  /** Target moving down on DV (global -Y), else null. */
  dorsoventralMillimeters: [number, number, number] | null;
}

/** A ray's one-column sampling geometry plus the mapping from output row to distance. */
interface RayMarch {
  geometry: SampleGeometry;
  /** Distance along the ray of output row 0, in mm. */
  firstMillimeters: number;
  /** Signed distance change per output row, in mm - always negative. */
  stepMillimeters: number;
}

/** Direction of increasing atlas DV (inferior, global -Y), in atlas ASR mm. */
const DORSOVENTRAL_DIRECTION: [number, number, number] = [0, 1, 0];

/** Ray samples per voxel along a level's finest axis, so a sample can't skip a voxel. */
const RAY_SAMPLES_PER_VOXEL = 2;

/**
 * How far a unit direction's alignment with DV may fall short of 1 and still
 * count as the DV direction. A chain resolves its depth axis through nested
 * rotations, so a probe aimed straight down never lands on it exactly.
 */
const DORSOVENTRAL_PARALLEL_EPSILON = 1e-6;

/**
 * Resolve where a probe's tip must move to sit on the brain surface.
 * @param frame Probe's shank-plane frame, in atlas ASR mm.
 * @param depthDirection Unit ASR direction of the chain's depth axis, or null when it has none.
 * @param level Annotation level to march through.
 * @param sampleRay Samples one ray geometry.
 */
export async function findProbeSurfaceTargets(
  frame: ProbeFrame,
  depthDirection: [number, number, number] | null,
  level: AnnotationLevel,
  sampleRay: RaySampler
): Promise<ProbeSurfaceTargets> {
  const origin = frame.originMillimeters;

  if (!depthDirection) {
    return {
      insideMillimeters: null,
      axisMillimeters: null,
      dorsoventralMillimeters: await findRayTarget(
        level,
        origin,
        DORSOVENTRAL_DIRECTION,
        "nearest",
        sampleRay
      )
    };
  }

  const inside = await findRayTarget(
    level,
    origin,
    depthDirection,
    "furthest",
    sampleRay
  );
  if (inside) {
    return {
      insideMillimeters: inside,
      axisMillimeters: null,
      dorsoventralMillimeters: null
    };
  }

  const reversedDepth: [number, number, number] = [
    -depthDirection[0],
    -depthDirection[1],
    -depthDirection[2]
  ];

  // The reversed depth axis and the DV direction are the same ray here, so
  // marching the axis too would just repeat the DV march.
  const alongDorsoventral =
    reversedDepth[0] * DORSOVENTRAL_DIRECTION[0] +
    reversedDepth[1] * DORSOVENTRAL_DIRECTION[1] +
    reversedDepth[2] * DORSOVENTRAL_DIRECTION[2];
  if (alongDorsoventral > 1 - DORSOVENTRAL_PARALLEL_EPSILON) {
    return {
      insideMillimeters: null,
      axisMillimeters: null,
      dorsoventralMillimeters: await findRayTarget(
        level,
        origin,
        DORSOVENTRAL_DIRECTION,
        "nearest",
        sampleRay
      )
    };
  }

  const [axisMillimeters, dorsoventralMillimeters] = await Promise.all([
    findRayTarget(level, origin, reversedDepth, "nearest", sampleRay),
    findRayTarget(level, origin, DORSOVENTRAL_DIRECTION, "nearest", sampleRay)
  ]);

  return { insideMillimeters: null, axisMillimeters, dorsoventralMillimeters };
}

/** Build a ray's sampling geometry, clipped to a level's voxel bounds. Null when it misses. */
function getRayMarch(
  level: AnnotationLevel,
  originMillimeters: [number, number, number],
  directionMillimeters: [number, number, number]
): RayMarch | null {
  // The ray starts at the tip and only goes forward.
  let near = 0;
  let far = Infinity;

  for (let axis = 0; axis < 3; axis++) {
    const lo = level.translationMillimeters[axis]!;
    const hi = lo + level.shapeVoxels[axis]! * level.scaleMillimeters[axis]!;
    const origin = originMillimeters[axis]!;
    const direction = directionMillimeters[axis]!;

    if (direction === 0) {
      if (origin < lo || origin >= hi) return null;
      continue;
    }

    const t0 = (lo - origin) / direction;
    const t1 = (hi - origin) / direction;
    near = Math.max(near, Math.min(t0, t1));
    far = Math.min(far, Math.max(t0, t1));
  }

  if (far <= near) return null;

  const length = far - near;
  const heightPixels = Math.max(
    1,
    Math.ceil(
      (length * RAY_SAMPLES_PER_VOXEL) / Math.min(...level.scaleMillimeters)
    )
  );
  const stepV = length / heightPixels;

  return {
    geometry: {
      // Unused: halfWidthMillimeters is 0, so every column is the band center.
      rightMillimeters: [1, 0, 0],
      upMillimeters: directionMillimeters,
      halfHeightMillimeters: length / 2,
      widthPixels: 1,
      heightPixels,
      bands: [
        {
          centerMillimeters: pointOnRay(
            originMillimeters,
            directionMillimeters,
            near + length / 2
          ),
          halfWidthMillimeters: 0,
          columnOffset: 0,
          columnCount: 1
        }
      ]
    },
    firstMillimeters: far - 0.5 * stepV,
    stepMillimeters: -stepV
  };
}

/**
 * Tip target on a ray: the point on the ray closest to the center of the nearest or
 * furthest non-background voxel it crosses. Null when it crosses none.
 */
async function findRayTarget(
  level: AnnotationLevel,
  originMillimeters: [number, number, number],
  directionMillimeters: [number, number, number],
  pick: "nearest" | "furthest",
  sampleRay: RaySampler
): Promise<[number, number, number] | null> {
  const march = getRayMarch(level, originMillimeters, directionMillimeters);
  if (!march) return null;

  const values = await sampleRay(march.geometry);
  if (!values) return null;

  // planSamples puts row 0 at the +up edge (furthest along the direction)
  // and marches toward -up (nearest), so "furthest" takes the lowest
  // non-zero index and "nearest" the highest.
  let row = -1;
  if (pick === "furthest") {
    for (let index = 0; index < values.length; index++) {
      if (values[index]) {
        row = index;
        break;
      }
    }
  } else {
    for (let index = values.length - 1; index >= 0; index--) {
      if (values[index]) {
        row = index;
        break;
      }
    }
  }
  if (row === -1) return null;

  const distance = march.firstMillimeters + row * march.stepMillimeters;
  if (distance <= 0) return null;

  // Snap to the voxel center, then project back onto the ray so the move
  // stays purely along the requested axis (a DV move must change only DV,
  // an axis move only the axis).
  const point = pointOnRay(originMillimeters, directionMillimeters, distance);
  const center: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const voxel = Math.floor(
      (point[axis]! - level.translationMillimeters[axis]!) /
        level.scaleMillimeters[axis]!
    );
    center[axis] =
      level.translationMillimeters[axis]! +
      (voxel + 0.5) * level.scaleMillimeters[axis]!;
  }
  const t =
    (center[0] - originMillimeters[0]) * directionMillimeters[0] +
    (center[1] - originMillimeters[1]) * directionMillimeters[1] +
    (center[2] - originMillimeters[2]) * directionMillimeters[2];
  if (t <= 0) return null;

  return pointOnRay(originMillimeters, directionMillimeters, t);
}

/**
 * Point at a distance along a ray from its origin.
 * @param originMillimeters Ray origin, in atlas ASR mm.
 * @param directionMillimeters Unit ray direction, in atlas ASR mm.
 * @param distance Distance along the ray, in mm.
 */
function pointOnRay(
  originMillimeters: [number, number, number],
  directionMillimeters: [number, number, number],
  distance: number
): [number, number, number] {
  return [
    originMillimeters[0] + directionMillimeters[0] * distance,
    originMillimeters[1] + directionMillimeters[1] * distance,
    originMillimeters[2] + directionMillimeters[2] * distance
  ];
}
