import { type ComponentMountingOptions, mount } from "@vue/test-utils";
import type { Component } from "vue";
import { Notify, Quasar } from "quasar";
import { createI18n } from "vue-i18n";
import { createPinia, type Pinia, setActivePinia } from "pinia";
import {
  DracoDecoder,
  GizmoManager,
  InitializeCSG2Async,
  IsCSG2Ready,
  NullEngine,
  Scene,
  SelectionOutlineLayer,
  UtilityLayerRenderer,
  WorkerPool
} from "@babylonjs/core";
import Module from "manifold-3d";
import messages from "@/i18n";

/**
 * Minimal i18n instance backed by the app's real `en-US` messages, so
 * components using `$t(...)` render actual copy instead of raw keys.
 */
function createTestI18n() {
  return createI18n({
    locale: "en-US",
    legacy: false,
    messages
  });
}

/**
 * Build a real Babylon `Scene` backed by a `NullEngine`, for tests that need
 * actual mesh geometry without a real GPU context.
 */
export function makeTestScene(): Scene {
  return new Scene(new NullEngine());
}

/**
 * Initialize Babylon's CSG2 from the bundled `manifold-3d` package, mirroring
 * `initializeCSG2` in `babylon-runtime.service.ts`, so tests that build
 * probes (whose head stage is CSG2-subtracted) don't hit
 * `TypeError: ManifoldMesh is not a constructor`. Safe to call from every
 * test that needs it -- guarded on `IsCSG2Ready()`, and initialization is
 * process-wide, so a `beforeAll` in one spec file is enough for that file.
 */
export async function initializeTestCSG2(): Promise<void> {
  if (IsCSG2Ready()) return;

  const manifold = await Module();
  manifold.setup();
  await InitializeCSG2Async({
    manifoldInstance: manifold.Manifold,
    manifoldMeshInstance: manifold.Mesh
  });
}

/**
 * Build a real Babylon `Scene` backed by a `NullEngine`, along with a
 * `GizmoManager` (both gizmos enabled) and a `SelectionOutlineLayer`, for
 * tests that need to exercise probe gizmo attachment and selection.
 *
 * Passes explicit utility layers to the `GizmoManager`: its defaults are
 * global statics keyed off the last-created scene, so two managers built for
 * two different test scenes would otherwise share one layer still bound to
 * whichever scene was created first -- including one a prior test already
 * disposed.
 */
export function makeTestSceneWithGizmo(): {
  scene: Scene;
  gizmoManager: GizmoManager;
  selectionOutlineLayer: SelectionOutlineLayer;
} {
  const scene = makeTestScene();
  const gizmoManager = new GizmoManager(
    scene,
    1,
    new UtilityLayerRenderer(scene),
    new UtilityLayerRenderer(scene)
  );
  gizmoManager.positionGizmoEnabled = true;
  gizmoManager.rotationGizmoEnabled = true;
  const selectionOutlineLayer = new SelectionOutlineLayer(
    "selection_outline_layer",
    scene
  );

  return { scene, gizmoManager, selectionOutlineLayer };
}

/**
 * Short-circuit `DracoDecoder`'s lazy worker pool construction with an
 * (unused) empty pool, so merely accessing `DracoDecoder.Default` doesn't
 * fetch the real wasm binary from cdn.babylonjs.com. Call once per file that
 * spies on `decodeMeshToGeometryAsync` directly.
 */
export function stubDracoDecoder(): void {
  DracoDecoder.ResetDefault(true);
  DracoDecoder.DefaultConfiguration = { workerPool: new WorkerPool([]) };
}

/**
 * Mount a component wired up with the same global plugins the real app
 * installs (Quasar, vue-i18n, Pinia), so components using `$t`, Quasar
 * components/directives, or a store don't need bespoke per-test wiring.
 *
 * A fresh Pinia instance is created and activated for every mount unless one
 * is passed in via `options.pinia`, so store state never leaks between
 * tests.
 */
export function mountWithQuasar<T extends Component>(
  component: T,
  options: ComponentMountingOptions<T> & { pinia?: Pinia } = {}
) {
  const { pinia = createPinia(), ...mountOptions } = options;
  setActivePinia(pinia);

  return mount(component, {
    ...mountOptions,
    global: {
      ...mountOptions.global,
      // Matches the app's own `framework.plugins` (quasar.config.ts) so
      // components calling `useQuasar().notify(...)` don't blow up. Spread after `...mountOptions.global` so a caller's
      // own `global.plugins` is merged in rather than clobbering this array.
      plugins: [
        [Quasar, { plugins: { Notify } }],
        createTestI18n(),
        pinia,
        ...(mountOptions.global?.plugins ?? [])
      ]
    }
  });
}
