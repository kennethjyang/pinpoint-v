import { describe, expect, it } from "vitest";
import { MeshBuilder, NullEngine, Scene, VertexBuffer } from "@babylonjs/core";
import {
  disposeMeshSimplifyPool,
  simplifyGeometryInWorker
} from "./mesh-simplify-pool.api";

/**
 * Build sphere geometry as flat, transferable typed arrays, mirroring what
 * `decodeMesh` hands off to the simplification worker.
 */
function makeSphereGeometry(): {
  positions: Float32Array;
  indices: Uint32Array;
} {
  const scene = new Scene(new NullEngine());
  const sphere = MeshBuilder.CreateSphere("sphere", { segments: 12 }, scene);
  const positions = Float32Array.from(
    sphere.getVerticesData(VertexBuffer.PositionKind)!
  );
  const indices = Uint32Array.from(sphere.getIndices()!);
  scene.dispose();

  return { positions, indices };
}

// `happy-dom` (this project's test environment) has no `Worker` global, so
// every test here exercises `simplifyGeometryInWorker`'s main-thread
// fallback path.
describe("simplifyGeometryInWorker", () => {
  it("reduces vertex count toward the target", async () => {
    const { positions, indices } = makeSphereGeometry();
    const originalCount = positions.length / 3;
    const target = Math.round(originalCount * 0.05);

    const result = await simplifyGeometryInWorker(positions, indices, target);

    expect(result.positions.length / 3).toBeLessThan(originalCount);
  });

  it("computes smooth-shaded normals for the result", async () => {
    const { positions, indices } = makeSphereGeometry();
    const target = Math.round(positions.length / 3 / 2);

    const result = await simplifyGeometryInWorker(positions, indices, target);

    expect(result.normals.length).toBe(result.positions.length);
  });

  it("passes geometry through unsimplified when already under the target", async () => {
    const { positions, indices } = makeSphereGeometry();
    const originalCount = positions.length / 3;

    const result = await simplifyGeometryInWorker(
      positions,
      indices,
      originalCount + 1000
    );

    expect(result.positions.length / 3).toBe(originalCount);
  });
});

describe("disposeMeshSimplifyPool", () => {
  it("does not throw when no pool has been created yet", () => {
    expect(() => disposeMeshSimplifyPool()).not.toThrow();
  });
});
