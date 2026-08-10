export interface CoordinateSystemValue {
  name: string;
  value: number;
  fixed: boolean;

  // Is ignored if fixed = true. Null means unbounded.
  bounds: [number, number] | null;
}
export interface CoordinateSystemNode {
  position: [
    CoordinateSystemValue,
    CoordinateSystemValue,
    CoordinateSystemValue
  ];

  // Mapping from XYZ index to a coordinate system value index.
  positionDisplayOrder: [number, number, number];

  rotation: [
    CoordinateSystemValue,
    CoordinateSystemValue,
    CoordinateSystemValue
  ];

  // Mapping from XYZ index to a coordinate system value index.
  rotationDisplayOrder: [number, number, number];

  // If this node is on the surface of the brain.
  onSurface: boolean;
}

/** Which triple of a coordinate system node a value belongs to. */
export type CoordinateSystemNodeComponent = "position" | "rotation";

export interface CoordinateSystem {
  inspectableKind: "coordinateSystem";
  id: string;
  name: string;

  // If the whole chain is offset by the experiment's reference coordinate.
  offsetByReferenceCoordinate: boolean;
  chain: CoordinateSystemNode[];
}
