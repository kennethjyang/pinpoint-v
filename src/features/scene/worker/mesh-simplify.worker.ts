/// <reference lib="webworker" />

import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { QuadraticErrorSimplification } from "@babylonjs/core/Meshes/meshSimplification.js";
import { Scene } from "@babylonjs/core/scene.js";
import type { SimplifiedGeometry } from "../models/structure-entity.model";

/** A mesh simplification request sent from the main thread. */
export interface MeshSimplifyRequest {
  id: number;
  positions: Float32Array;
  indices: Uint32Array;
  targetVertices: number;
}

/** A successful mesh simplification response. */
export interface MeshSimplifyResponse extends SimplifiedGeometry {
  id: number;
}

/** A failed mesh simplification response. */
export interface MeshSimplifyErrorResponse {
  id: number;
  error: string;
}

/**
 * Scratch scene reused across every simplification task in this worker. A
 * Babylon `Scene` is required to host the meshes `QuadraticErrorSimplification`
 * operates on, but none of its rendering capabilities are needed here.
 */
const scratchScene = new Scene(new NullEngine());

/**
 * Simplify a mesh's geometry down to (approximately) the given vertex count
 * and compute smooth-shaded normals for it.
 *
 * Exported so {@link simplifyGeometryInWorker}'s main-thread fallback can
 * call it directly, without going through `postMessage`.
 * @param positions Flat `[x, y, z, ...]` vertex positions.
 * @param indices Triangle indices.
 * @param targetVertices Desired vertex count.
 */
export async function simplifyGeometry(
  positions: Float32Array,
  indices: Uint32Array,
  targetVertices: number
): Promise<SimplifiedGeometry> {
  const mesh = new Mesh("scratch", scratchScene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.applyToMesh(mesh);

  let simplified = mesh;
  if (targetVertices < mesh.getTotalVertices()) {
    simplified = await new Promise<Mesh>(resolve => {
      new QuadraticErrorSimplification(mesh).simplify(
        {
          quality: targetVertices / mesh.getTotalVertices(),
          distance: 0,
          optimizeMesh: false
        },
        resolve
      );
    });
    mesh.dispose();
  }

  simplified.createNormals(false);

  const result: SimplifiedGeometry = {
    positions: Float32Array.from(
      simplified.getVerticesData(VertexBuffer.PositionKind)!
    ),
    normals: Float32Array.from(
      simplified.getVerticesData(VertexBuffer.NormalKind)!
    ),
    indices: Uint32Array.from(simplified.getIndices()!)
  };

  simplified.dispose();
  return result;
}

self.onmessage = async (event: MessageEvent<MeshSimplifyRequest>) => {
  const { id, positions, indices, targetVertices } = event.data;

  try {
    const result = await simplifyGeometry(positions, indices, targetVertices);
    const response: MeshSimplifyResponse = { id, ...result };
    self.postMessage(response, [
      result.positions.buffer,
      result.normals.buffer,
      result.indices.buffer
    ]);
  } catch (error) {
    const response: MeshSimplifyErrorResponse = { id, error: String(error) };
    self.postMessage(response);
  }
};
