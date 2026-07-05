/**
 * @file Composable to inject Babylon runtime service.
 */

import { inject } from "vue";
import { BabylonRuntimeKey } from "@/services/babylon-runtime.service";

/**
 * Inject the Babylon runtime service and return it.
 *
 * @throws Error if the injection doesn't return something.
 */
export function useBabylonRuntime() {
  const runtime = inject(BabylonRuntimeKey);

  if (!runtime) {
    throw new Error("Babylon runtime was not provided.");
  }

  return runtime;
}
