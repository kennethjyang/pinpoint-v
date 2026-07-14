import { Vector3 } from "@babylonjs/core";

/**
 * Convert an ASR coordinate (AP, DV, ML, in mm) to Babylon world space.
 *
 * Mapping: A -> -Z, S -> -Y, R -> +X.
 *
 * @param coordinate ASR coordinate as [a, s, r].
 * @returns The equivalent Babylon Vector3.
 */
export function asrToBabylon([a, s, r]: [number, number, number]): Vector3 {
  return new Vector3(r, -s, -a);
}

/**
 * Convert a Babylon world-space vector back to an ASR coordinate (AP, DV, ML).
 *
 * Inverse of {@link asrToBabylon}.
 *
 * @param vector Babylon Vector3.
 * @returns The equivalent ASR coordinate as [a, s, r].
 */
export function babylonToAsr(vector: Vector3): [number, number, number] {
  return [-vector.z, -vector.y, vector.x];
}
