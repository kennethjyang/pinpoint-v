import { inject } from "vue";
import { BabylonRuntimeServiceKey } from "@/services/babylon-runtime.service";

/**
 * Inject the Babylon runtime service and return it.
 *
 * @throws Error if the injection doesn't return something.
 */
export function useBabylonRuntimeService() {
  const runtime = inject(BabylonRuntimeServiceKey);

  if (!runtime) {
    throw new Error("Babylon runtime service was not provided.");
  }

  return runtime;
}
