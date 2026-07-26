import { AutoReleaseWorkerPool } from "@babylonjs/core";
import {
  createMeshSimplifyWorker,
  loadMeshSimplifyWorkerModule
} from "@/features/scene";
import type {
  MeshSimplifyErrorResponse,
  MeshSimplifyRequest,
  MeshSimplifyResponse,
  SimplifiedGeometry
} from "@/features/scene";

interface PendingRequest {
  resolve: (geometry: SimplifiedGeometry) => void;
  reject: (reason: unknown) => void;
  onComplete: () => void;
}

/**
 * Number of simplification workers to spin up.
 *
 * Mirrors Babylon's own default sizing for its Draco decoder worker pool
 * (`@babylonjs/core/Meshes/Compression/dracoCodec.js`): half the logical
 * processors, capped at 4, so this pool doesn't oversubscribe the machine
 * alongside Draco's own workers.
 */
function defaultWorkerCount(): number {
  if (typeof navigator !== "object" || !navigator.hardwareConcurrency) {
    return 1;
  }
  return Math.min(Math.floor(navigator.hardwareConcurrency * 0.5), 4);
}

let pool: AutoReleaseWorkerPool | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, PendingRequest>();

/**
 * Create a mesh simplification worker, wiring its responses back to
 * whichever request they answer.
 */
function createSimplifyWorkerAsync(): Promise<Worker> {
  const worker = createMeshSimplifyWorker();

  worker.onmessage = (
    event: MessageEvent<MeshSimplifyResponse | MeshSimplifyErrorResponse>
  ) => {
    const pending = pendingRequests.get(event.data.id);
    if (!pending) return;
    pendingRequests.delete(event.data.id);

    if ("error" in event.data) {
      pending.reject(new Error(event.data.error));
    } else {
      const { id: _id, ...geometry } = event.data;
      pending.resolve(geometry);
    }
    pending.onComplete();
  };

  return Promise.resolve(worker);
}

/**
 * Get the shared mesh simplification worker pool, creating it on first use.
 */
function getPool(): AutoReleaseWorkerPool {
  pool ??= new AutoReleaseWorkerPool(
    defaultWorkerCount(),
    createSimplifyWorkerAsync
  );
  return pool;
}

/**
 * Simplify a mesh's geometry down to (approximately) the given vertex count
 * and compute smooth-shaded normals for it, off the main thread.
 *
 * Falls back to running synchronously on the main thread in environments
 * without `Worker` (e.g. tests).
 *
 * @param positions Flat `[x, y, z, ...]` vertex positions.
 * @param indices Triangle indices.
 * @param targetVertices Desired vertex count.
 */
export async function simplifyGeometryInWorker(
  positions: Float32Array,
  indices: Uint32Array,
  targetVertices: number
): Promise<SimplifiedGeometry> {
  if (typeof Worker !== "function") {
    return await simplifyGeometryOnMainThread(
      positions,
      indices,
      targetVertices
    );
  }

  const id = nextRequestId++;
  const request: MeshSimplifyRequest = {
    id,
    positions,
    indices,
    targetVertices
  };

  return await new Promise<SimplifiedGeometry>((resolve, reject) => {
    getPool().push((worker, onComplete) => {
      pendingRequests.set(id, { resolve, reject, onComplete });
      worker.postMessage(request, [positions.buffer, indices.buffer]);
    });
  });
}

/**
 * Dispose the shared mesh simplification worker pool. Call on app teardown.
 */
export function disposeMeshSimplifyPool(): void {
  pool?.dispose();
  pool = null;
  pendingRequests.clear();
}

/**
 * Main-thread fallback for {@link simplifyGeometryInWorker}, used when the
 * `Worker` global is unavailable (e.g. under `happy-dom` in tests).
 */
async function simplifyGeometryOnMainThread(
  positions: Float32Array,
  indices: Uint32Array,
  targetVertices: number
): Promise<SimplifiedGeometry> {
  const { simplifyGeometry } = await loadMeshSimplifyWorkerModule();
  return await simplifyGeometry(positions, indices, targetVertices);
}
