interface CoordinateSystemValue {
  name: string;
  value: number;
  fixed: boolean;

  // Is ignored if fixed = true. Null means unbounded.
  bounds: [number, number] | null;
}
interface CoordinateSystemNode {
  position: [
    CoordinateSystemValue,
    CoordinateSystemValue,
    CoordinateSystemValue
  ];
  rotation: [
    CoordinateSystemValue,
    CoordinateSystemValue,
    CoordinateSystemValue
  ];
}

export interface CoordinateSystem {
  inspectableKind: "coordinateSystem";
  id: string;
  name: string;
  chain: CoordinateSystemNode[];
}
