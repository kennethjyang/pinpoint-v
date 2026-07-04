import { InjectionKey, readonly, shallowRef } from "vue";
import { Scene, WebGPUEngine } from "@babylonjs/core";

export function createBabylonRuntime() {
  const engine = shallowRef<WebGPUEngine | null>(null);
  const scene = shallowRef<Scene | null>(null);

  async function init(canvas: HTMLCanvasElement): Promise<void> {
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

  function dispose(): void {
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
