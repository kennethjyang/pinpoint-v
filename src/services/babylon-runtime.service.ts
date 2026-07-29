import type { InjectionKey } from "vue";
import { markRaw, type ShallowRef, shallowReadonly, shallowRef } from "vue";
import {
  ArcRotateCamera,
  GizmoManager,
  HemisphericLight,
  Scene,
  Vector3,
  WebGPUEngine
} from "@babylonjs/core";

/**
 * Service holding the Babylon engine, scene, camera, and gizmo manager
 * references for one runtime.
 */
export interface BabylonRuntimeService {
  engine: Readonly<ShallowRef<WebGPUEngine | null>>;
  scene: Readonly<ShallowRef<Scene | null>>;
  camera: Readonly<ShallowRef<ArcRotateCamera | null>>;
  gizmoManager: Readonly<ShallowRef<GizmoManager | null>>;
  init: (canvas: HTMLCanvasElement) => Promise<void>;
  dispose: () => void;
}

export const BabylonRuntimeServiceKey: InjectionKey<BabylonRuntimeService> =
  Symbol("BabylonRuntimeService");

/**
 * Create a service holding the Babylon engine, scene, camera, and gizmo
 * manager references for one runtime.
 */
export function createBabylonRuntimeService(): BabylonRuntimeService {
  const engine = shallowRef<WebGPUEngine | null>(null);
  const scene = shallowRef<Scene | null>(null);
  const camera = shallowRef<ArcRotateCamera | null>(null);
  const gizmoManager = shallowRef<GizmoManager | null>(null);

  /**
   * Create the runtime from a canvas. Does nothing if already initialized.
   * @param canvas HTML canvas to attach the runtime to.
   */
  async function init(canvas: HTMLCanvasElement) {
    if (engine.value) return;

    const e = markRaw(new WebGPUEngine(canvas));
    e.compatibilityMode = false;
    await e.initAsync();

    const s = markRaw(new Scene(e));

    const c = new ArcRotateCamera(
      "main_camera",
      -Math.PI / 2,
      Math.PI / 8,
      0,
      Vector3.Zero(),
      s
    );
    c.attachControl(canvas, true);

    const gm = new GizmoManager(s);
    gm.positionGizmoEnabled = true;
    gm.rotationGizmoEnabled = true;

    new HemisphericLight("main_light", Vector3.Up(), s);

    e.runRenderLoop(() => {
      s.render();
    });

    engine.value = e;
    scene.value = s;
    camera.value = c;
    gizmoManager.value = gm;
  }

  /**
   * Cleanup this runtime.
   */
  function dispose() {
    gizmoManager.value?.dispose();
    camera.value?.dispose();
    scene.value?.dispose();
    engine.value?.dispose();

    gizmoManager.value = null;
    camera.value = null;
    scene.value = null;
    engine.value = null;
  }

  return {
    engine: shallowReadonly(engine),
    scene: shallowReadonly(scene),
    camera: shallowReadonly(camera),
    gizmoManager: shallowReadonly(gizmoManager),
    init,
    dispose
  };
}
