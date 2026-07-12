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
    const e = markRaw(new WebGPUEngine(canvas));
    e.compatibilityMode = false;
    await e.initAsync();

    // Attach scene.
    const s = markRaw(new Scene(e));

    // Attach camera.
    const camera = new ArcRotateCamera(
      "main_camera",
      -Math.PI / 2,
      Math.PI / 4,
      10,
      Vector3.Zero(),
      s
    );
    camera.attachControl(canvas, true);

    // Attach gizmo manager.
    const gizmoManager = new GizmoManager(s);
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;

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
    gizmoManager.attachToNode(probeMover);

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
    engine: shallowReadonly(engine),
    scene: shallowReadonly(scene),
    init,
    dispose
  };
}

export type BabylonRuntime = ReturnType<typeof createBabylonRuntime>;

export const BabylonRuntimeKey: InjectionKey<BabylonRuntime> =
  Symbol("BabylonRuntime");
