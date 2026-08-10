import type {
  CoordinateSystem,
  CoordinateSystemNode,
  CoordinateSystemValue
} from "../model/coordinate-system.model";

/**
 * Build an adjustable coordinate system value.
 * @param name Display name of the value.
 * @param bounds Inclusive range the value is limited to, or null for unbounded.
 * @param value Initial value.
 */
export function buildCoordinateSystemValue(
  name: string,
  bounds: [number, number] | null = null,
  value = 0
): CoordinateSystemValue {
  return { name, value, fixed: false, bounds };
}

/**
 * Build a fixed coordinate system value, which is always unbounded.
 * @param name Display name of the value.
 * @param value Fixed value.
 */
export function buildFixedCoordinateSystemValue(
  name = "",
  value = 0
): CoordinateSystemValue {
  return { name, value, fixed: true, bounds: null };
}

/**
 * Build a coordinate system chain node from its position and rotation values.
 * @param position Position values.
 * @param rotation Rotation values.
 * @param positionDisplayOrder Mapping from XYZ index to position value index.
 * @param rotationDisplayOrder Mapping from XYZ index to rotation value index.
 * @param onSurface Whether this node must reside on the surface of the brain.
 */
export function buildCoordinateSystemNode(
  position: [
    CoordinateSystemValue,
    CoordinateSystemValue,
    CoordinateSystemValue
  ],
  rotation: [
    CoordinateSystemValue,
    CoordinateSystemValue,
    CoordinateSystemValue
  ],
  positionDisplayOrder: [number, number, number] = [0, 1, 2],
  rotationDisplayOrder: [number, number, number] = [0, 1, 2],
  onSurface = false
): CoordinateSystemNode {
  return {
    position,
    positionDisplayOrder,
    rotation,
    rotationDisplayOrder,
    onSurface
  };
}

/**
 * Build a coordinate system with a fresh id.
 * @param name Display name of the coordinate system.
 * @param chain Transform chain, applied in order.
 */
export function buildCoordinateSystem(
  name: string,
  chain: CoordinateSystemNode[]
): CoordinateSystem {
  return {
    inspectableKind: "coordinateSystem",
    id: crypto.randomUUID(),
    name,
    chain
  };
}

/**
 * Append an all-zero, unbounded, unfixed transform to a coordinate system's chain.
 * @param coordinateSystem Coordinate system to append to, mutated in place.
 */
export function addCoordinateSystemTransform(
  coordinateSystem: CoordinateSystem
): void {
  coordinateSystem.chain.push(
    buildCoordinateSystemNode(
      [
        buildCoordinateSystemValue("ML"),
        buildCoordinateSystemValue("DV"),
        buildCoordinateSystemValue("AP")
      ],
      [
        buildCoordinateSystemValue("Pitch"),
        buildCoordinateSystemValue("Yaw"),
        buildCoordinateSystemValue("Roll")
      ]
    )
  );
}
