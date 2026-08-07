import type { FloatArray, IndicesArray, Mesh } from "@babylonjs/core";
import { VertexBuffer } from "@babylonjs/core";

/**
 * Check whether a triangle mesh's winding encloses negative volume, meaning
 * its faces point inward instead of outward.
 * @param positions Flat `[x, y, z, x, y, z, ...]` vertex positions.
 * @param indices Triangle indices into `positions`, three per face.
 */
export function isMeshInsideOut(
  positions: FloatArray,
  indices: IndicesArray
): boolean {
  let signedVolume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 3;
    const b = indices[i + 1]! * 3;
    const c = indices[i + 2]! * 3;
    const ax = positions[a]!;
    const ay = positions[a + 1]!;
    const az = positions[a + 2]!;
    const bx = positions[b]!;
    const by = positions[b + 1]!;
    const bz = positions[b + 2]!;
    const cx = positions[c]!;
    const cy = positions[c + 1]!;
    const cz = positions[c + 2]!;
    // Signed volume of the tetrahedron formed by the triangle and the origin,
    // summed across every face: negative overall means the winding is reversed.
    signedVolume +=
      ax * (by * cz - bz * cy) -
      ay * (bx * cz - bz * cx) +
      az * (bx * cy - by * cx);
  }
  return signedVolume < 0;
}

/**
 * Recompute a mesh's normals so they point outward, flipping its winding
 * first if the mesh currently encloses negative volume.
 * @param mesh Mesh to orient and recompute normals for.
 */
export function orientNormalsOutward(mesh: Mesh): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (positions && indices && isMeshInsideOut(positions, indices)) {
    mesh.flipFaces(false);
  }
  mesh.createNormals(false);
}
