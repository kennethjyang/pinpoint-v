import { Color3 } from "@babylonjs/core";

/**
 * Structure 3D mesh entity config for Babylon.
 */
export interface StructureEntity {
  /**
   * Terminology identifier of the structure. Babylon mesh and material
   * names are derived from this, not from the structure's display name.
   */
  identifier: number;
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
