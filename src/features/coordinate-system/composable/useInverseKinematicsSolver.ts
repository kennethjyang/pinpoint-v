import { onScopeDispose } from "vue";
import { createSharedComposable } from "@vueuse/core";
import type { CoordinateSystemSolution } from "../api/forward-kinematics.api";
import type {
  CoordinateSystemSolveStatus,
  CoordinateSystemTarget
} from "../api/inverse-kinematics.api";
import type { CoordinateSystemNode } from "../model/coordinate-system.model";
import type {
  InboundInverseKinematicsMessage,
  OutboundInverseKinematicsMessage
} from "../model/inverse-kinematics-message.model";

/** The subset of `Worker` the solver depends on. */
export interface InverseKinematicsWorker {
  postMessage(message: InboundInverseKinematicsMessage): void;
  onmessage:
    | ((event: MessageEvent<OutboundInverseKinematicsMessage>) => void)
    | null;
  terminate(): void;
}

/** Builds one solver worker. Overridable in tests to avoid a real `Worker`. */
export type InverseKinematicsWorkerFactory = () => InverseKinematicsWorker;

/** One chain-onto-pose solve, handed to the solver worker. */
export interface InverseKinematicsSolveRequest {
  chain: CoordinateSystemNode[];
  target: CoordinateSystemTarget;
  referenceOffsetMillimeters: [number, number, number] | null;
  maximumStarts: number;
}

/** A completed solve: the solved chain, its status, and its forward solution. */
export interface InverseKinematicsSolveResult {
  status: CoordinateSystemSolveStatus;
  chain: CoordinateSystemNode[];
  solution: CoordinateSystemSolution;
}

/** Default factory for the real inverse-kinematics worker. */
function defaultWorkerFactory(): InverseKinematicsWorker {
  return new Worker(
    new URL("../workers/inverse-kinematics.worker.ts", import.meta.url),
    { type: "module" }
  );
}

/**
 * Create a single-worker inverse-kinematics solver that keeps only the newest queued request.
 * @param workerFactory Builds the solver worker.
 */
export function createInverseKinematicsSolver(
  workerFactory: InverseKinematicsWorkerFactory = defaultWorkerFactory
): {
  solve: (
    request: InverseKinematicsSolveRequest
  ) => Promise<InverseKinematicsSolveResult | null>;
} {
  const worker = workerFactory();

  let nextRequestId = 1;
  let inFlight: {
    requestId: number;
    settle: (result: InverseKinematicsSolveResult | null) => void;
  } | null = null;
  let queued: {
    request: InverseKinematicsSolveRequest;
    settle: (result: InverseKinematicsSolveResult | null) => void;
  } | null = null;

  function post(
    requestId: number,
    request: InverseKinematicsSolveRequest
  ): void {
    worker.postMessage({
      type: "solveInverseKinematics",
      requestId,
      ...request
    });
  }

  worker.onmessage = event => {
    const current = inFlight;
    if (!current || event.data.requestId !== current.requestId) return;

    const { status, chain, solution } = event.data;
    current.settle({ status, chain, solution });
    inFlight = null;

    if (queued) {
      const requestId = nextRequestId++;
      inFlight = { requestId, settle: queued.settle };
      post(requestId, queued.request);
      queued = null;
    }
  };

  function solve(
    request: InverseKinematicsSolveRequest
  ): Promise<InverseKinematicsSolveResult | null> {
    return new Promise(resolve => {
      if (inFlight === null) {
        const requestId = nextRequestId++;
        inFlight = { requestId, settle: resolve };
        post(requestId, request);
        return;
      }

      queued?.settle(null);
      queued = { request, settle: resolve };
    });
  }

  onScopeDispose(() => {
    worker.terminate();
    inFlight?.settle(null);
    inFlight = null;
    queued?.settle(null);
    queued = null;
  });

  return { solve };
}

/** The app-wide inverse-kinematics solver, shared by every consumer. */
export const useInverseKinematicsSolver = createSharedComposable(() =>
  createInverseKinematicsSolver()
);
