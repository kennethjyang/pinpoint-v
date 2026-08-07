import { describe, expect, it, vi } from "vitest";
import { Color3, Vector3 } from "@babylonjs/core";
import type { StandardMaterial } from "@babylonjs/core";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { addSceneObject, buildExperiment } from "@/features/experiment";
import { makeAtlas, makeSceneObject } from "@/test/fixtures";
import {
  makeTestGlbBytes,
  makeTestSceneWithPhysics,
  tickScene
} from "@/test/mount-helper";
import { asrToVector3 } from "./coordinate-transforms.api";
import {
  attachSceneObjectSelection,
  buildSceneObjectNode,
  createSceneObjectSyncState,
  disposeSceneObjectNode,
  getSceneObjectMeshes,
  getSceneObjectTransformNode,
  syncSceneObjects
} from "./scene-object-node.api";

// `buildSceneObjectNode` imports the stored GLB through `ImportMeshAsync`,
// which needs the glTF plugin factory registered, mirroring the app boot.
registerBuiltInLoaders();

/**
 * Build an experiment holding one scene object, for sync tests.
 * @param overrides Fields to override on the default scene object.
 */
function makeExperimentWithSceneObject(
  overrides: Parameters<typeof makeSceneObject>[0] = {}
) {
  const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
  const sceneObject = makeSceneObject(overrides);
  addSceneObject(experiment, sceneObject);
  return { experiment, sceneObject };
}

describe("buildSceneObjectNode", () => {
  it("builds a transform node holding one colored merged mesh, registered as gizmo-attachable", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject({ color: "#00ff00" });
    const glbBytes = await makeTestGlbBytes();

    const node = await buildSceneObjectNode(
      scene,
      sceneObject,
      glbBytes,
      gizmoManager
    );

    expect(node).not.toBeNull();
    expect(node!.name).toBe(`${sceneObject.id}_object_node`);
    expect(node!.parent!.name).toBe("referenceCoordinate_node");

    const meshes = node!.getChildMeshes();
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!;
    expect(mesh.name).toBe(`${sceneObject.id}_object_mesh`);
    const material = mesh.material as StandardMaterial;
    expect(material.name).toBe(`${sceneObject.id}_object_material`);
    expect(material.diffuseColor.equals(Color3.FromHexString("#00ff00"))).toBe(
      true
    );

    expect(gizmoManager.attachableMeshes).toContain(mesh);
  });

  it("returns the existing node without rebuilding when already built", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject();
    const glbBytes = await makeTestGlbBytes();

    const first = await buildSceneObjectNode(
      scene,
      sceneObject,
      glbBytes,
      gizmoManager
    );
    const second = await buildSceneObjectNode(
      scene,
      sceneObject,
      glbBytes,
      gizmoManager
    );

    expect(second).toBe(first);
  });
});

describe("disposeSceneObjectNode", () => {
  it("removes the node, mesh, material, and collider node", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject();
    const glbBytes = await makeTestGlbBytes();
    await buildSceneObjectNode(scene, sceneObject, glbBytes, gizmoManager);

    disposeSceneObjectNode(scene, sceneObject.id, gizmoManager);

    expect(getSceneObjectTransformNode(scene, sceneObject.id)).toBeNull();
    expect(scene.getMeshByName(`${sceneObject.id}_object_mesh`)).toBeNull();
    expect(
      scene.getMaterialByName(`${sceneObject.id}_object_material`)
    ).toBeNull();
    expect(
      scene.getTransformNodeByName(`${sceneObject.id}_object_collider`)
    ).toBeNull();
  });
});

describe("syncSceneObjects", () => {
  it("snaps a freshly built object to its ASR pose", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject({
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3]
    });
    const glbBytes = await makeTestGlbBytes();
    const state = createSceneObjectSyncState();

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      async () => glbBytes
    );

    const node = getSceneObjectTransformNode(scene, sceneObject.id)!;
    expect(node.position.equals(asrToVector3(sceneObject.position))).toBe(true);
    expect(node.rotation.equals(asrToVector3(sceneObject.rotation))).toBe(true);
  });

  it("interpolates an existing object's pose change over time", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const glbBytes = await makeTestGlbBytes();
    const state = createSceneObjectSyncState();
    const loadGlb = async () => glbBytes;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    sceneObject.position = [5, 0, 0];
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );

    const node = getSceneObjectTransformNode(scene, sceneObject.id)!;
    // Interpolation has started but not finished after a single small tick.
    tickScene(scene, 50);
    expect(node.position.equals(asrToVector3(sceneObject.position))).toBe(
      false
    );
    tickScene(scene, 1000);
    expect(node.position.equals(asrToVector3(sceneObject.position))).toBe(true);
  });

  it("recolors the material when the object's color changes", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject({
      color: "#ff0000"
    });
    const glbBytes = await makeTestGlbBytes();
    const state = createSceneObjectSyncState();
    const loadGlb = async () => glbBytes;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    sceneObject.color = "#0000ff";
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );

    const material = scene.getMaterialByName(
      `${sceneObject.id}_object_material`
    ) as StandardMaterial;
    expect(material.diffuseColor.equals(Color3.FromHexString("#0000ff"))).toBe(
      true
    );
  });

  it("disables the mesh but keeps the collider physics body when hidden", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const glbBytes = await makeTestGlbBytes();
    const state = createSceneObjectSyncState();
    const loadGlb = async () => glbBytes;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    sceneObject.visibility = "hidden";
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );

    const mesh = getSceneObjectMeshes(scene, sceneObject.id)[0]!;
    expect(mesh.isEnabled()).toBe(false);
    expect(
      scene.getTransformNodeByName(`${sceneObject.id}_object_collider`)
        ?.physicsBody
    ).not.toBeNull();
  });

  it("skips pose updates for the object being dragged", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const glbBytes = await makeTestGlbBytes();
    const state = createSceneObjectSyncState();
    const loadGlb = async () => glbBytes;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    const node = getSceneObjectTransformNode(scene, sceneObject.id)!;
    node.position = Vector3.Zero();
    sceneObject.position = [9, 9, 9];

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      sceneObject.id,
      loadGlb
    );

    expect(node.position.equals(Vector3.Zero())).toBe(true);
  });

  it("disposes a node whose scene object left the experiment", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const glbBytes = await makeTestGlbBytes();
    const state = createSceneObjectSyncState();
    const loadGlb = async () => glbBytes;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    experiment.sceneObjects = [];
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );

    expect(getSceneObjectTransformNode(scene, sceneObject.id)).toBeNull();
  });

  it("records a missing GLB as failed and returns it once, without retrying on the next sync", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const state = createSceneObjectSyncState();
    const loadGlb = vi.fn(async () => null);

    const firstFailures = await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    expect(firstFailures).toEqual([sceneObject.id]);
    expect(loadGlb).toHaveBeenCalledTimes(1);

    const secondFailures = await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    expect(secondFailures).toEqual([]);
    expect(loadGlb).toHaveBeenCalledTimes(1);
  });

  it("forgets a failure once the object leaves the experiment", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const state = createSceneObjectSyncState();
    const loadGlb = vi.fn(async () => null);

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    expect(state.failedIds.has(sceneObject.id)).toBe(true);

    experiment.sceneObjects = [];
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      state,
      null,
      loadGlb
    );
    expect(state.failedIds.has(sceneObject.id)).toBe(false);
  });
});

describe("attachSceneObjectSelection", () => {
  it("leaves the gizmo detached but still outlines the mesh for a locked object", async () => {
    const { scene, gizmoManager, selectionOutlineLayer } =
      await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject({ lock: true });
    const glbBytes = await makeTestGlbBytes();
    const node = (await buildSceneObjectNode(
      scene,
      sceneObject,
      glbBytes,
      gizmoManager
    ))!;

    attachSceneObjectSelection(
      gizmoManager,
      selectionOutlineLayer,
      sceneObject,
      node
    );

    expect(gizmoManager.attachedNode).toBeNull();
    for (const mesh of node.getChildMeshes()) {
      expect(selectionOutlineLayer.hasMesh(mesh)).toBe(true);
    }
  });

  it("attaches the gizmo to the node for an unlocked object", async () => {
    const { scene, gizmoManager, selectionOutlineLayer } =
      await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject({ lock: false });
    const glbBytes = await makeTestGlbBytes();
    const node = (await buildSceneObjectNode(
      scene,
      sceneObject,
      glbBytes,
      gizmoManager
    ))!;

    attachSceneObjectSelection(
      gizmoManager,
      selectionOutlineLayer,
      sceneObject,
      node
    );

    expect(gizmoManager.attachedNode).toBe(node);
  });
});
