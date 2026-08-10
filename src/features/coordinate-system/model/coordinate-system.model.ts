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
}

export interface CoordinateSystem {
  inspectableKind: "coordinateSystem";
  id: string;
  name: string;
  chain: CoordinateSystemNode[];
}
