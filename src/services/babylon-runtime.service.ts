import { InjectionKey, markRaw, shallowReadonly, shallowRef } from "vue";
import {
  ArcRotateCamera,
  GizmoManager,
  HemisphericLight,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3,
  WebGPUEngine
} from "@babylonjs/core";

/**
 * Service creator. Hosts the references to the engine and scene.
 */
export function createBabylonRuntimeService() {
  const engine = shallowRef<WebGPUEngine | null>(null);
  const scene = shallowRef<Scene | null>(null);
  const camera = shallowRef<ArcRotateCamera | null>(null);
  const gizmoManager = shallowRef<GizmoManager | null>(null);

  /**
   * Create the runtime from a canvas.
   * @param canvas HTML canvas to attach the runtime to.
   */
  async function init(canvas: HTMLCanvasElement) {
    // Cancel if already initialized.
    if (engine.value) return;

    // Initialize engine.
    const e = markRaw(new WebGPUEngine(canvas));
    e.compatibilityMode = false;
    await e.initAsync();

    // Attach scene.
    const s = markRaw(new Scene(e));

    // Attach camera.
    const c = new ArcRotateCamera(
      "main_camera",
      -Math.PI / 2,
      Math.PI / 8,
      0,
      Vector3.Zero(),
      s
    );
    c.attachControl(canvas, true);

    // Attach gizmo manager.
    const gm = new GizmoManager(s);
    gm.positionGizmoEnabled = true;
    gm.rotationGizmoEnabled = true;

    // Add lights.
    new HemisphericLight("main_light", Vector3.Up(), s);

    // Build a demo scene.
    const probeMesh = MeshBuilder.CreateBox(
      "probe_mesh",
      { width: 0.25, depth: 0.25, height: 2 },
      s
    );
    probeMesh.setAbsolutePosition(Vector3.Up());
    const probeMover = new TransformNode("probeTip_node", s);
    probeMover.addChild(probeMesh);
    gm.attachToNode(probeMover);

    // Start render loop.
    e.runRenderLoop(() => {
      s.render();
    });

    // Set refs.
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

export type BabylonRuntimeService = ReturnType<
  typeof createBabylonRuntimeService
>;

export const BabylonRuntimeServiceKey: InjectionKey<BabylonRuntimeService> =
  Symbol("BabylonRuntimeService");
