import { describe, expect, it, vi } from "vitest";
import { Color3, TransformNode, Vector3 } from "@babylonjs/core";
import type {
  DragStartEndEvent,
  Mesh,
  StandardMaterial
} from "@babylonjs/core";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { addSceneObject, buildExperiment } from "@/features/experiment";
import {
  makeAtlas,
  makeSceneObject,
  makeTransformInputs
} from "@/test/fixtures";
import {
  makeTestModelFile,
  makeTestSceneWithGizmo,
  makeTestSceneWithPhysics,
  tickScene
} from "@/test/mount-helper";
import { asrToVector3 } from "./coordinate-transforms.api";
import {
  attachSceneObjectSelection,
  buildSceneObjectNode,
  createSceneObjectSyncState,
  disposeSceneObjectNode,
  endSceneObjectGizmoDrag,
  getSceneObjectMeshes,
  getSceneObjectTransformNode,
  syncSceneObjects
} from "./scene-object-node.api";
import { getTransformChains } from "./transform-chain.api";

// `buildSceneObjectNode` imports the stored model file through `ImportMeshAsync`,
// which needs the glTF plugin factory registered, mirroring the app boot.
registerBuiltInLoaders();

/** Chains every sync resolves poses against: the built-in default alone. */
const CHAINS = getTransformChains([]);

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
  it("builds a transform node holding one colored part mesh, registered as gizmo-attachable", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject({ color: "#00ff00" });
    const modelFile = await makeTestModelFile();

    const built = await buildSceneObjectNode(
      scene,
      sceneObject,
      modelFile,
      gizmoManager
    );

    expect(built).not.toBeNull();
    expect(built!.colliderFailed).toBe(false);
    const node = built!.node;
    expect(node.name).toBe(`${sceneObject.id}_object_node`);
    expect(node.parent!.name).toBe("referenceCoordinate_node");

    const meshes = getSceneObjectMeshes(scene, sceneObject.id);
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!;
    expect(mesh.name).toBe(`${sceneObject.id}_object_mesh0`);
    const material = mesh.material as StandardMaterial;
    expect(material.name).toBe(`${sceneObject.id}_object_material`);
    expect(material.diffuseColor.equals(Color3.FromHexString("#00ff00"))).toBe(
      true
    );

    expect(gizmoManager.attachableMeshes).toContain(mesh);
  });

  it("preserves the loader's hierarchy under one root, instead of merging it into a single primitive", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject();
    const modelFile = await makeTestModelFile();

    const built = await buildSceneObjectNode(
      scene,
      sceneObject,
      modelFile,
      gizmoManager
    );

    const root = built!.node.getChildren()[0]!;
    expect(root.name).toBe(`${sceneObject.id}_object_root`);
    const mesh = root.getChildren()[0] as Mesh;
    expect(mesh.name).toBe(`${sceneObject.id}_object_mesh0`);
    expect(mesh.getTotalVertices()).toBeGreaterThan(0);
  });

  it("returns the existing node without rebuilding when already built", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject();
    const modelFile = await makeTestModelFile();

    const first = await buildSceneObjectNode(
      scene,
      sceneObject,
      modelFile,
      gizmoManager
    );
    const second = await buildSceneObjectNode(
      scene,
      sceneObject,
      modelFile,
      gizmoManager
    );

    expect(second!.node).toBe(first!.node);
  });
});

describe("disposeSceneObjectNode", () => {
  it("removes the node, mesh, material, and collider node", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject();
    const modelFile = await makeTestModelFile();
    await buildSceneObjectNode(scene, sceneObject, modelFile, gizmoManager);

    disposeSceneObjectNode(scene, sceneObject.id, gizmoManager);

    expect(getSceneObjectTransformNode(scene, sceneObject.id)).toBeNull();
    expect(scene.getMeshByName(`${sceneObject.id}_object_mesh0`)).toBeNull();
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
      transformInputs: makeTransformInputs({
        globalTranslation: [1, 2, 3],
        globalRotation: [0, 0.2, 0.3]
      })
    });
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      async () => modelFile
    );

    const { globalTranslation, globalRotation } = sceneObject.transformInputs;
    const node = getSceneObjectTransformNode(scene, sceneObject.id)!;
    expect(node.position.equals(asrToVector3(globalTranslation))).toBe(true);
    // Rotation resolves through a quaternion, so it lands on the ASR angles
    // to float precision rather than bit-exactly.
    expect(
      node.rotation.subtract(asrToVector3(globalRotation)).length()
    ).toBeCloseTo(0, 10);
    expect(node.scaling.equals(asrToVector3(sceneObject.scale))).toBe(true);
  });

  it("snaps a freshly built object to its chain-resolved pose, not its global translation alone", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject({
      transformInputs: makeTransformInputs({
        globalTranslation: [1, 2, 3],
        localTranslation: [4, 0, 0]
      })
    });
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      async () => modelFile
    );

    // The default chain translates globally, then again along the object's own
    // depth axis, which is AP while it is unrotated.
    const node = getSceneObjectTransformNode(scene, sceneObject.id)!;
    expect(node.position.equals(asrToVector3([5, 2, 3]))).toBe(true);
    expect(node.position.equals(asrToVector3([1, 2, 3]))).toBe(false);
  });

  it("interpolates an existing object's pose change over time", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    sceneObject.transformInputs.globalTranslation = [5, 0, 0];
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );

    const goal = asrToVector3(sceneObject.transformInputs.globalTranslation);
    const node = getSceneObjectTransformNode(scene, sceneObject.id)!;
    // Interpolation has started but not finished after a single small tick.
    tickScene(scene, 50);
    expect(node.position.equals(goal)).toBe(false);
    tickScene(scene, 1000);
    expect(node.position.equals(goal)).toBe(true);
  });

  it("recolors the material when the object's color changes", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject({
      color: "#ff0000"
    });
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    sceneObject.color = "#0000ff";
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
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
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    sceneObject.visibility = "hidden";
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );

    const mesh = getSceneObjectMeshes(scene, sceneObject.id)[0]!;
    expect(mesh.isEnabled()).toBe(false);
    expect(
      scene.getTransformNodeByName(`${sceneObject.id}_object_collider`)
        ?.physicsBody
    ).not.toBeNull();
  });

  it("removes the collider body when collidable turns off, keeping the mesh", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    expect(
      scene.getTransformNodeByName(`${sceneObject.id}_object_collider`)
    ).not.toBeNull();

    sceneObject.collidable = false;
    const result = await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );

    expect(result.colliderChangedIds).toEqual([sceneObject.id]);

    expect(
      scene.getTransformNodeByName(`${sceneObject.id}_object_collider`)
    ).toBeNull();
    expect(getSceneObjectMeshes(scene, sceneObject.id)).toHaveLength(1);
  });

  it("builds no collider for a fresh object with collidable off, then builds one once it turns on", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject({
      collidable: false
    });
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    expect(
      scene.getTransformNodeByName(`${sceneObject.id}_object_collider`)
    ).toBeNull();

    sceneObject.collidable = true;
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );

    expect(
      scene.getTransformNodeByName(`${sceneObject.id}_object_collider`)
    ).not.toBeNull();
  });

  it("re-cooks the collider when the object's scale changes", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;
    const colliderName = `${sceneObject.id}_object_collider`;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    const firstCollider = scene.getTransformNodeByName(colliderName);
    expect(firstCollider).not.toBeNull();
    expect(state.colliderScales.get(sceneObject.id)).toEqual([1, 1, 1]);

    sceneObject.scale = [2, 2, 2];
    const result = await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    expect(result.colliderChangedIds).toEqual([sceneObject.id]);

    const secondCollider = scene.getTransformNodeByName(colliderName);
    expect(secondCollider).not.toBeNull();
    expect(secondCollider).not.toBe(firstCollider);
    expect(state.colliderScales.get(sceneObject.id)).toEqual([2, 2, 2]);
  });

  it("skips pose updates for the object being dragged", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    const node = getSceneObjectTransformNode(scene, sceneObject.id)!;
    node.position = Vector3.Zero();
    sceneObject.transformInputs.globalTranslation = [9, 9, 9];

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      sceneObject.id,
      loadModel
    );

    expect(node.position.equals(Vector3.Zero())).toBe(true);
  });

  it("disposes a node whose scene object left the experiment", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const modelFile = await makeTestModelFile();
    const state = createSceneObjectSyncState();
    const loadModel = async () => modelFile;

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    experiment.sceneObjects = [];
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );

    expect(getSceneObjectTransformNode(scene, sceneObject.id)).toBeNull();
  });

  it("records a missing model file as failed and returns it once, without retrying on the next sync", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const state = createSceneObjectSyncState();
    const loadModel = vi.fn(async () => null);

    const firstFailures = await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    expect(firstFailures.failedIds).toEqual([sceneObject.id]);
    expect(loadModel).toHaveBeenCalledTimes(1);

    const secondFailures = await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    expect(secondFailures.failedIds).toEqual([]);
    expect(loadModel).toHaveBeenCalledTimes(1);
  });

  it("forgets a failure once the object leaves the experiment", async () => {
    const { scene, gizmoManager } = await makeTestSceneWithPhysics();
    const { experiment, sceneObject } = makeExperimentWithSceneObject();
    const state = createSceneObjectSyncState();
    const loadModel = vi.fn(async () => null);

    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    expect(state.failedIds.has(sceneObject.id)).toBe(true);

    experiment.sceneObjects = [];
    await syncSceneObjects(
      scene,
      experiment,
      gizmoManager,
      CHAINS,
      state,
      null,
      loadModel
    );
    expect(state.failedIds.has(sceneObject.id)).toBe(false);
  });
});

describe("endSceneObjectGizmoDrag", () => {
  it("reports a scale drag-end on a scene object node", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const scaleGizmo = gizmoManager.gizmos.scaleGizmo!;
    const onDragEnd = vi.fn();
    endSceneObjectGizmoDrag(scaleGizmo, onDragEnd);

    gizmoManager.attachToNode(new TransformNode("abc123_object_node", scene));
    scaleGizmo.onDragEndObservable.notifyObservers({} as DragStartEndEvent);

    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  it("never reports a drag-end on a node that is not a scene object", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const scaleGizmo = gizmoManager.gizmos.scaleGizmo!;
    const onDragEnd = vi.fn();
    endSceneObjectGizmoDrag(scaleGizmo, onDragEnd);

    gizmoManager.attachToNode(new TransformNode("abc123_probe_node", scene));
    scaleGizmo.onDragEndObservable.notifyObservers({} as DragStartEndEvent);

    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it("returns the observer, so the caller can stop listening", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const scaleGizmo = gizmoManager.gizmos.scaleGizmo!;
    const onDragEnd = vi.fn();
    const observer = endSceneObjectGizmoDrag(scaleGizmo, onDragEnd);

    gizmoManager.attachToNode(new TransformNode("abc123_object_node", scene));
    scaleGizmo.onDragEndObservable.remove(observer);
    scaleGizmo.onDragEndObservable.notifyObservers({} as DragStartEndEvent);

    expect(onDragEnd).not.toHaveBeenCalled();
  });
});

describe("attachSceneObjectSelection", () => {
  it("leaves the gizmo detached but still outlines the mesh for a locked object", async () => {
    const { scene, gizmoManager, selectionOutlineLayer } =
      await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject({ lock: true });
    const modelFile = await makeTestModelFile();
    const node = (await buildSceneObjectNode(
      scene,
      sceneObject,
      modelFile,
      gizmoManager
    ))!.node;

    attachSceneObjectSelection(
      gizmoManager,
      selectionOutlineLayer,
      sceneObject,
      node
    );

    expect(gizmoManager.attachedNode).toBeNull();
    for (const mesh of getSceneObjectMeshes(scene, sceneObject.id)) {
      expect(selectionOutlineLayer.hasMesh(mesh)).toBe(true);
    }
  });

  it("attaches the gizmo to the node for an unlocked object", async () => {
    const { scene, gizmoManager, selectionOutlineLayer } =
      await makeTestSceneWithPhysics();
    const sceneObject = makeSceneObject({ lock: false });
    const modelFile = await makeTestModelFile();
    const node = (await buildSceneObjectNode(
      scene,
      sceneObject,
      modelFile,
      gizmoManager
    ))!.node;

    attachSceneObjectSelection(
      gizmoManager,
      selectionOutlineLayer,
      sceneObject,
      node
    );

    expect(gizmoManager.attachedNode).toBe(node);
  });
});
