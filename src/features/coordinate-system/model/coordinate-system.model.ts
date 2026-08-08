interface CoordinateSystemValue {
  name: string;
  value: number;
  fixed: boolean;
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
