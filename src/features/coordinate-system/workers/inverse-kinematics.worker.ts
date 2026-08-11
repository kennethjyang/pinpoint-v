import type { InboundInverseKinematicsMessage } from "../model/inverse-kinematics-message.model";
import { handleInverseKinematicsMessage } from "./inverse-kinematics-handler";

// The project's lib config doesn't include `webworker`, so `self` types as
// `Window` here. This file only ever runs inside a dedicated worker (loaded
// via Vite's `?worker` import), where `self` is the worker global scope.
interface DedicatedWorkerScope {
  postMessage(message: unknown): void;
  onmessage:
    | ((event: MessageEvent<InboundInverseKinematicsMessage>) => void)
    | null;
}
const workerScope = self as unknown as DedicatedWorkerScope;

workerScope.onmessage = event => {
  workerScope.postMessage(handleInverseKinematicsMessage(event.data));
};
