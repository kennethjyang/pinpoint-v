import { describe, expect, it, vi } from "vitest";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import {
  addProbe,
  buildExperiment,
  internProbeInterfaceProbe
} from "@/features/experiment";
import type { Experiment } from "@/features/experiment";
import type { Probe } from "@/features/probe";
import { getProbeInterfaceIdentifier } from "@/features/probe";
import {
  makeAtlas,
  makeProbe,
  makeProbeGeometry,
  makeProbeInterfaceProbe,
  makeSceneModel
} from "@/test/fixtures";
import {
  makeTestModelFile,
  makeTestSceneWithPhysics
} from "@/test/mount-helper";
import { buildProbe, getProbeTransformNode } from "./probe.api";
import {
  buildProbeBodyModelNode,
  createProbeBodyModelSyncState,
  getProbeBodyModelMeshes,
  getProbeBodyModelNode,
  syncProbeBodyModels
} from "./probe-body-model.api";

// `buildProbeBodyModelNode` imports the stored model file through
// `ImportMeshAsync`, which needs the glTF plugin factory registered,
// mirroring the app boot.
registerBuiltInLoaders();

/** Single-shank contour (imec NP1000), in micrometers. */
const NP1000_CONTOUR = [
  [-11, 9989],
  [-11, -11],
  [24, -220],
  [59, -11],
  [59, 9989]
];

/**
 * Build an experiment with a single interned probe interface definition and a
 * probe referencing it, with a valid contour so the scene-level `buildProbe`
 * can build its node.
 * @param probeOverrides Fields to override on the default probe.
 */
function makeExperimentWithProbe(probeOverrides: Partial<Probe> = {}): {
  experiment: Experiment;
  probe: Probe;
} {
  const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
  const probeInterfaceProbe = makeProbeInterfaceProbe({
    probe_planar_contour: NP1000_CONTOUR
  });
  internProbeInterfaceProbe(experiment, probeInterfaceProbe);

  const probe = makeProbe({
    probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe),
    ...probeOverrides
  });
  addProbe(experiment, probe);

  return { experiment, probe };
}

describe("buildProbeBodyModelNode", () => {
  it("builds one part mesh under the probe node, skinned with the probe's own material, disposing the loader's own material", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const bodyModel = makeSceneModel();
    const { experiment, probe } = makeExperimentWithProbe({ bodyModel });
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    const modelFile = await makeTestModelFile();

    const node = await buildProbeBodyModelNode(
      scene,
      probe,
      modelFile,
      gizmoManager
    );

    expect(node).not.toBeNull();
    expect(node!.name).toBe(`${probe.id}_probe_body-model_node`);
    expect(node!.parent!.name).toBe(`${probe.id}_probe_node`);

    const meshes = getProbeBodyModelMeshes(scene, probe.id);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]!.name).toBe(`${probe.id}_probe_body-model_mesh0`);
    expect(meshes[0]!.material!.name).toBe(`${probe.id}_probe_material`);
    expect(gizmoManager.attachableMeshes).toContain(meshes[0]);

    // Only the probe's own material remains -- the loader's own material,
    // which the box's glTF export carries, was disposed rather than left
    // orphaned in the scene.
    expect(scene.materials.map(material => material.name)).toEqual([
      `${probe.id}_probe_material`
    ]);
  });

  it("returns the existing node without rebuilding when already built", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const bodyModel = makeSceneModel();
    const { experiment, probe } = makeExperimentWithProbe({ bodyModel });
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    const modelFile = await makeTestModelFile();

    const first = await buildProbeBodyModelNode(
      scene,
      probe,
      modelFile,
      gizmoManager
    );
    const second = await buildProbeBodyModelNode(
      scene,
      probe,
      modelFile,
      gizmoManager
    );

    expect(second).toBe(first);
  });
});

describe("syncProbeBodyModels", () => {
  it("applies the body model's local pose to the node unswapped, not through ASR", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const bodyModel = makeSceneModel({
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: [2, 3, 4]
    });
    const { experiment, probe } = makeExperimentWithProbe({ bodyModel });
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    const modelFile = await makeTestModelFile();
    const state = createProbeBodyModelSyncState();

    await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      async () => modelFile
    );

    const node = getProbeBodyModelNode(scene, probe.id)!;
    expect([node.position.x, node.position.y, node.position.z]).toEqual([
      1, 2, 3
    ]);
    expect([node.rotation.x, node.rotation.y, node.rotation.z]).toEqual([
      0.1, 0.2, 0.3
    ]);
    expect([node.scaling.x, node.scaling.y, node.scaling.z]).toEqual([2, 3, 4]);
  });

  it('hides the body model for "shanks" and "hidden" visibility', async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const bodyModel = makeSceneModel();
    const { experiment, probe } = makeExperimentWithProbe({
      bodyModel,
      visibility: "visible"
    });
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    const modelFile = await makeTestModelFile();
    const state = createProbeBodyModelSyncState();
    const loadModel = async () => modelFile;

    await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    const node = getProbeBodyModelNode(scene, probe.id)!;
    expect(node.isEnabled()).toBe(true);

    probe.visibility = "shanks";
    await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    expect(node.isEnabled()).toBe(false);

    probe.visibility = "hidden";
    await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    expect(node.isEnabled()).toBe(false);
  });

  it("cooks a collider that re-cooks on a pose change but not on an unchanged second sync", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const bodyModel = makeSceneModel();
    const { experiment, probe } = makeExperimentWithProbe({ bodyModel });
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    const modelFile = await makeTestModelFile();
    const state = createProbeBodyModelSyncState();
    const loadModel = async () => modelFile;
    const colliderName = `${probe.id}_probe_collider`;

    await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    const firstCollider = scene.getTransformNodeByName(colliderName);
    expect(firstCollider).not.toBeNull();

    const unchanged = await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    expect(unchanged.colliderChangedIds).toEqual([]);
    expect(scene.getTransformNodeByName(colliderName)).toBe(firstCollider);

    probe.bodyModel!.scale = [2, 2, 2];
    const changed = await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    expect(changed.colliderChangedIds).toEqual([probe.id]);
    const secondCollider = scene.getTransformNodeByName(colliderName);
    expect(secondCollider).not.toBeNull();
    expect(secondCollider).not.toBe(firstCollider);
  });

  it("records a missing model file as failed and returns it once, without retrying on the next sync", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const bodyModel = makeSceneModel();
    const { experiment, probe } = makeExperimentWithProbe({ bodyModel });
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    const state = createProbeBodyModelSyncState();
    const loadModel = vi.fn(async () => null);

    const first = await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    expect(first.failedIds).toEqual([probe.id]);
    expect(loadModel).toHaveBeenCalledTimes(1);

    const second = await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );
    expect(second.failedIds).toEqual([]);
    expect(loadModel).toHaveBeenCalledTimes(1);
  });

  it("does not sync a probe whose transform node isn't built yet, and doesn't mark it failed", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const bodyModel = makeSceneModel();
    const { experiment, probe } = makeExperimentWithProbe({ bodyModel });
    const state = createProbeBodyModelSyncState();
    const loadModel = vi.fn(async () => await makeTestModelFile());

    expect(getProbeTransformNode(scene, probe.id)).toBeNull();

    const result = await syncProbeBodyModels(
      scene,
      experiment,
      gizmoManager,
      state,
      loadModel
    );

    expect(result.failedIds).toEqual([]);
    expect(loadModel).not.toHaveBeenCalled();
    expect(state.failedIds.has(probe.id)).toBe(false);
  });
});
