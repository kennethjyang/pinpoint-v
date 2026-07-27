/**
 * Create a mesh simplification worker.
 *
 * Vite's static analysis for bundling a `new Worker(new URL(...))` call
 * requires a literal relative specifier, so this can't be re-exported as a
 * plain value.
 */
export function createMeshSimplifyWorker(): Worker {
  return new Worker(new URL("./mesh-simplify.worker", import.meta.url), {
    type: "module"
  });
}

/**
 * Lazily load the mesh simplification worker's implementation module, for
 * use as a main-thread fallback when the `Worker` global is unavailable.
 *
 * Kept as a dynamic import so the module's own scratch Babylon `Scene` isn't
 * constructed on the main thread unless this fallback actually runs.
 */
export function loadMeshSimplifyWorkerModule() {
  return import("./mesh-simplify.worker");
}
