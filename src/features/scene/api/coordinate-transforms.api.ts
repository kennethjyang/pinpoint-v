import { Vector3 } from "@babylonjs/core";

/**
 * Convert an ASR coordinate (AP, DV, ML, in mm) to Babylon world space.
 * @param coordinate ASR coordinate as [a, s, r].
 */
export function asrToBabylon([a, s, r]: [number, number, number]): Vector3 {
  return new Vector3(r, -s, -a);
}

/**
 * Convert an ASR coordinate (AP, DV, ML, in mm) to a Vector 3 (ML, DV, AP)
 * @param coordinate ASR coordinate as [a, s, r].
 */
export function asrToVector3([a, s, r]: [number, number, number]): Vector3 {
  return new Vector3(r, s, a);
}

/**
 * Convert a Babylon world-space vector back to an ASR coordinate (AP, DV, ML).
 * Inverse of {@link asrToBabylon}.
 * @param vector Babylon Vector3.
 */
export function babylonToAsr(vector: Vector3): [number, number, number] {
  return [-vector.z, -vector.y, vector.x];
}
