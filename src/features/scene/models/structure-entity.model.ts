import { Color3 } from "@babylonjs/core";

/**
 * Structure 3D mesh entity config for Babylon.
 */
export interface StructureEntity {
  name: string;
  meshPath: string;
  color: Color3;
}

/**
 * Vertex data for a simplified mesh, as returned by the mesh simplification
 * worker pool. Kept as plain transferable typed arrays since Babylon meshes
 * can't cross a worker boundary.
 */
export interface SimplifiedGeometry {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}
