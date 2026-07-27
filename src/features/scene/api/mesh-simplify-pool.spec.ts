import { afterEach, describe, expect, it, vi } from "vitest";
import { MeshBuilder, NullEngine, Scene, VertexBuffer } from "@babylonjs/core";
import {
  disposeMeshSimplifyPool,
  simplifyGeometryInWorker
} from "./mesh-simplify-pool.api";

/**
 * Minimal `Worker` stand-in that never responds, so a request made through
 * it stays pending until something else settles it -- letting tests exercise
 * teardown-while-in-flight without a real worker thread.
 */
class UnresponsiveWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage(): void {}
  terminate(): void {}
}

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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a request still pending at teardown instead of leaving it hanging", async () => {
    // Stub `Worker` so this request goes through the real worker-pool path
    // (`happy-dom`'s missing `Worker` global would otherwise route it
    // through the main-thread fallback, which has nothing to reject).
    vi.stubGlobal("Worker", UnresponsiveWorker);
    const { positions, indices } = makeSphereGeometry();

    const pending = simplifyGeometryInWorker(positions, indices, 10);
    // Let the pool assign a worker and post the message before disposing.
    await new Promise(resolve => setTimeout(resolve, 0));

    disposeMeshSimplifyPool();

    await expect(pending).rejects.toThrow();
  });
});
