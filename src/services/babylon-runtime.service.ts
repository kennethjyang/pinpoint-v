/**
 * @file Babylon runtime service that hosts the engine and scene.
 */

import { InjectionKey, readonly, shallowRef } from "vue";
import { Scene, WebGPUEngine } from "@babylonjs/core";

/**
 * Service creator. Hosts the references to the engine and scene.
 */
export function createBabylonRuntime() {
  const engine = shallowRef<WebGPUEngine | null>(null);
  const scene = shallowRef<Scene | null>(null);

  /**
   * Create the runtime from a canvas.
   * @param canvas HTML canvas to attach the runtime to.
   */
  async function init(canvas: HTMLCanvasElement) {
    // Cancel if already initialized.
    if (engine.value) return;

    // Initialize engine.
    const e = new WebGPUEngine(canvas);
    e.compatibilityMode = false;
    await e.initAsync();

    // Attach scene.
    const s = new Scene(e);

    // Start render loop.
    e.runRenderLoop(() => {
      s.render();
    });

    // Set refs.
    engine.value = e;
    scene.value = s;
  }

  /**
   * Cleanup this runtime.
   */
  function dispose() {
    scene.value?.dispose();
    engine.value?.dispose();

    scene.value = null;
    engine.value = null;
  }

  return {
    engine: readonly(engine),
    scene: readonly(scene),
    init,
    dispose
  };
}

export type BabylonRuntime = ReturnType<typeof createBabylonRuntime>;

export const BabylonRuntimeKey: InjectionKey<BabylonRuntime> =
  Symbol("BabylonRuntime");
