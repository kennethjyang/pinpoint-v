import type { CoordinateSystem } from "../model/coordinate-system.model";

/**
 * Append an all-zero, unbounded, unfixed transform to a coordinate system's chain.
 * @param coordinateSystem Coordinate system to append to, mutated in place.
 */
export function addCoordinateSystemTransform(
  coordinateSystem: CoordinateSystem
): void {
  coordinateSystem.chain.push({
    position: [
      { name: "ML", value: 0, fixed: false, bounds: null },
      { name: "DV", value: 0, fixed: false, bounds: null },
      { name: "AP", value: 0, fixed: false, bounds: null }
    ],
    rotation: [
      { name: "Pitch", value: 0, fixed: false, bounds: null },
      { name: "Yaw", value: 0, fixed: false, bounds: null },
      { name: "Roll", value: 0, fixed: false, bounds: null }
    ]
  });
}
