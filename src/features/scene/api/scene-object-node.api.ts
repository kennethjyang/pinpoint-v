import type {
  AbstractMesh,
  DragEvent,
  DragStartEndEvent,
  GizmoManager,
  IGizmo,
  IPositionGizmo,
  IRotationGizmo,
  Nullable,
  Observer,
  Scene,
  SelectionOutlineLayer
} from "@babylonjs/core";
import {
  Color3,
  ImportMeshAsync,
  Mesh,
  PhysicsShapeConvexHull,
  StandardMaterial,
  TransformNode
} from "@babylonjs/core";
import type { Experiment } from "@/features/experiment";
import { setMaterialDiffuseColor } from "./material.api";
import { buildReferenceCoordinateNode } from "./reference-coordinate.api";
import { asrToVector3, vector3ToAsr } from "./coordinate-transforms.api";
import { buildCollisionBody, disposeCollisionBody } from "./collision.api";
import {
  buildSceneEntityName,
  isSceneEntityName,
  sceneEntityIdFromName,
  sceneEntityNameSuffix
} from "./scene-entity.api";
import {
  interpolateNodePose,
  stopNodePoseInterpolation
} from "./pose-interpolation.api";
import type { SceneObject } from "../models/scene-object.model";
import type { TransformGizmos } from "../models/gizmo.model";

/** Suffix applied to a scene object's id to name its parenting transform node. */
const SCENE_OBJECT_NODE_SUFFIX = sceneEntityNameSuffix("object", "node");
/** Suffix applied to a scene object's id to name its merged mesh. */
const SCENE_OBJECT_MESH_SUFFIX = sceneEntityNameSuffix("object", "mesh");

/** Load bookkeeping for scene object GLBs, so a re-sync neither double-builds nor retries forever. */
export interface SceneObjectSyncState {
  /** Ids whose GLB is being loaded right now. */
  loadingIds: Set<string>;
  /** Ids whose GLB failed to load, cleared when the id leaves the experiment. */
  failedIds: Set<string>;
}

/** Build empty scene object load bookkeeping. */
export function createSceneObjectSyncState(): SceneObjectSyncState {
  return { loadingIds: new Set(), failedIds: new Set() };
}

/**
 * Get a scene object's transform node by ID.
 * @param scene Scene to search for the object.
 * @param sceneObjectId ID of the scene object to get.
 */
export function getSceneObjectTransformNode(
  scene: Scene,
  sceneObjectId: string
): TransformNode | null {
  return scene.getTransformNodeByName(
    buildSceneEntityName(sceneObjectId, "object", "node")
  );
}

/**
 * A scene object's meshes, or an empty list when the object is not built.
 * @param scene Scene the object was built in.
 * @param sceneObjectId Scene object id whose meshes to get.
 */
export function getSceneObjectMeshes(
  scene: Scene,
  sceneObjectId: string
): Mesh[] {
  return (
    getSceneObjectTransformNode(scene, sceneObjectId)
      ?.getChildMeshes(false)
      .filter((mesh): mesh is Mesh => mesh instanceof Mesh) ?? []
  );
}

/**
 * Build a scene object's material, colored from the object.
 * @param scene Scene to build the material in.
 * @param sceneObject Scene object to derive the material's color from.
 */
function buildSceneObjectMaterial(
  scene: Scene,
  sceneObject: SceneObject
): StandardMaterial {
  const material = new StandardMaterial(
    buildSceneEntityName(sceneObject.id, "object", "material"),
    scene
  );
  material.diffuseColor = Color3.FromHexString(sceneObject.color);
  material.freeze();
  return material;
}

/**
 * Build a scene object's merged mesh from its stored GLB, or return its
 * existing transform node if already built. The collider is a convex hull
 * around the merged mesh, not an exact triangle-mesh shape.
 * @param scene Scene to build the object in.
 * @param sceneObject Scene object to build.
 * @param glbBytes GLB bytes to import the object's geometry from.
 * @param gizmoManager Gizmo manager to add the object's mesh to.
 */
export async function buildSceneObjectNode(
  scene: Scene,
  sceneObject: SceneObject,
  glbBytes: Uint8Array,
  gizmoManager: GizmoManager
): Promise<TransformNode | null> {
  const existing = getSceneObjectTransformNode(scene, sceneObject.id);
  if (existing) return existing;

  const node = new TransformNode(
    buildSceneEntityName(sceneObject.id, "object", "node"),
    scene
  );
  node.parent = buildReferenceCoordinateNode(scene);

  const result = await ImportMeshAsync(glbBytes, scene, {
    pluginExtension: ".glb",
    name: `${sceneObject.id}.glb`
  });
  const meshes = result.meshes.filter(
    (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0
  );
  // Merge even for the single primitive the stored GLB holds: it bakes the glTF
  // loader's `__root__` right-to-left-handed conversion into the vertices, which a
  // plain reparent would drop and mirror the model.
  const merged = meshes.length
    ? Mesh.MergeMeshes(meshes, true, true, undefined, false, false)
    : null;
  if (!merged) {
    for (const mesh of result.meshes) if (!mesh.isDisposed()) mesh.dispose();
    for (const transformNode of result.transformNodes) transformNode.dispose();
    node.dispose();
    return null;
  }

  merged.name = buildSceneEntityName(sceneObject.id, "object", "mesh");
  merged.material = buildSceneObjectMaterial(scene, sceneObject);
  merged.parent = node;
  for (const mesh of result.meshes) if (!mesh.isDisposed()) mesh.dispose();
  for (const transformNode of result.transformNodes) transformNode.dispose();

  // Ignore the return value: no physics engine on the scene keeps this feature additive.
  // A convex hull, not an exact `PhysicsShapeMesh`, approximates the collider: Havok's
  // triangle-mesh trigger shapes proved unstable (observed hangs) when they coexist with
  // another entity's shapes in the same physics world.
  buildCollisionBody(node, sceneObject.id, "object", () => [
    { shape: new PhysicsShapeConvexHull(merged, scene), mesh: merged }
  ]);

  gizmoManager.attachableMeshes ??= [];
  gizmoManager.attachableMeshes.push(merged);
  return node;
}

/**
 * Dispose a scene object's transform node, its mesh, and its own material.
 * @param scene Scene the object was built in.
 * @param sceneObjectId Scene object ID to remove any existing entity for.
 * @param gizmoManager Gizmo manager to remove the object's mesh from.
 */
export function disposeSceneObjectNode(
  scene: Scene,
  sceneObjectId: string,
  gizmoManager: GizmoManager
): void {
  const node = getSceneObjectTransformNode(scene, sceneObjectId);
  if (gizmoManager.attachedNode === node) {
    gizmoManager.attachToNode(null);
  }

  if (node) stopNodePoseInterpolation(node);
  disposeCollisionBody(scene, sceneObjectId, "object");
  // `true` for `disposeMaterialAndTextures`, unlike probes: the flag propagates to the
  // child mesh, and the object's `StandardMaterial` belongs to it alone.
  node?.dispose(false, true);
  gizmoManager.attachableMeshes = (gizmoManager.attachableMeshes ?? []).filter(
    mesh => !mesh.name.startsWith(sceneObjectId)
  );
}

/**
 * Synchronize the scene object entities with their states, building,
 * recoloring, repositioning, and disposing them as needed.
 * @param scene Scene to sync the scene objects of.
 * @param experiment Experiment to pull scene object data to sync from.
 * @param gizmoManager Gizmo manager for controlling scene objects.
 * @param state Load bookkeeping to update in place.
 * @param draggedSceneObjectId ID of the scene object being dragged (if any).
 * @param loadGlb Loader for a scene object's stored GLB bytes.
 */
export async function syncSceneObjects(
  scene: Scene,
  experiment: Experiment,
  gizmoManager: GizmoManager,
  state: SceneObjectSyncState,
  draggedSceneObjectId: string | null,
  loadGlb: (sceneObjectId: string) => Promise<Uint8Array | null>
): Promise<string[]> {
  const referenceCoordinateNode = buildReferenceCoordinateNode(scene);
  const sceneObjectsById = new Map(
    experiment.sceneObjects.map(sceneObject => [sceneObject.id, sceneObject])
  );

  for (const node of referenceCoordinateNode.getChildren(child =>
    child.name.endsWith(SCENE_OBJECT_NODE_SUFFIX)
  ) as TransformNode[]) {
    const id = sceneEntityIdFromName(node.name, "object");
    if (!sceneObjectsById.has(id))
      disposeSceneObjectNode(scene, id, gizmoManager);
  }
  for (const id of state.failedIds) {
    if (!sceneObjectsById.has(id)) state.failedIds.delete(id);
  }
  for (const id of state.loadingIds) {
    if (!sceneObjectsById.has(id)) state.loadingIds.delete(id);
  }

  const newlyFailedIds: string[] = [];
  for (const sceneObject of experiment.sceneObjects) {
    let node = getSceneObjectTransformNode(scene, sceneObject.id);
    const isFresh = !node;
    if (!node) {
      if (
        state.loadingIds.has(sceneObject.id) ||
        state.failedIds.has(sceneObject.id)
      ) {
        continue;
      }
      state.loadingIds.add(sceneObject.id);
      try {
        const glbBytes = await loadGlb(sceneObject.id);
        node = glbBytes
          ? await buildSceneObjectNode(
              scene,
              sceneObject,
              glbBytes,
              gizmoManager
            )
          : null;
      } catch {
        node = null;
      } finally {
        state.loadingIds.delete(sceneObject.id);
      }
      // The scene can be torn down while a GLB loads.
      if (scene.isDisposed) return newlyFailedIds;
      if (!node) {
        state.failedIds.add(sceneObject.id);
        newlyFailedIds.push(sceneObject.id);
        continue;
      }
    }

    const mesh = node
      .getChildMeshes(false)
      .find(child => child.name.endsWith(SCENE_OBJECT_MESH_SUFFIX));
    const material = mesh?.material;
    if (material instanceof StandardMaterial) {
      setMaterialDiffuseColor(
        material,
        Color3.FromHexString(sceneObject.color)
      );
    }
    // The collider node is a sibling of the mesh, so a hidden object still collides.
    mesh?.setEnabled(sceneObject.visibility === "visible");

    if (sceneObject.id === draggedSceneObjectId) continue;

    const goalPosition = asrToVector3(sceneObject.position);
    const goalRotation = asrToVector3(sceneObject.rotation);
    if (isFresh) {
      node.position = goalPosition;
      node.rotation = goalRotation;
      continue;
    }
    if (
      node.position.equals(goalPosition) &&
      node.rotation.equals(goalRotation)
    ) {
      continue;
    }
    interpolateNodePose(scene, node, {
      position: goalPosition,
      rotation: goalRotation
    });
  }
  return newlyFailedIds;
}

/**
 * Attach the gizmo to a scene object's transform node and select its mesh,
 * leaving a locked object outlined but without a gizmo.
 * @param gizmoManager Gizmo manager to attach to the object's node.
 * @param selectionOutlineLayer Selection outline layer to add the object's mesh to.
 * @param sceneObject Scene object being selected, whose lock decides whether a gizmo attaches.
 * @param sceneObjectTransformNode Scene object transform node to attach and select.
 */
export function attachSceneObjectSelection(
  gizmoManager: GizmoManager,
  selectionOutlineLayer: SelectionOutlineLayer,
  sceneObject: SceneObject,
  sceneObjectTransformNode: TransformNode
): void {
  gizmoManager.attachToNode(sceneObject.lock ? null : sceneObjectTransformNode);
  selectionOutlineLayer.clearSelection();
  selectionOutlineLayer.addSelection(sceneObjectTransformNode.getChildMeshes());
}

/**
 * Select a scene object in the scene based on the Gizmo's pick.
 * @param scene Scene with scene objects.
 * @param gizmoManager Gizmo manager to update.
 * @param selectionOutlineLayer Selection outline layer to add the object to selection.
 * @param sceneObjects Experiment scene objects to resolve the attached mesh against.
 * @param onSelect Callback invoked with the scene object whose mesh was attached to.
 */
export function selectSceneObjectFromGizmoAttach(
  scene: Scene,
  gizmoManager: GizmoManager,
  selectionOutlineLayer: SelectionOutlineLayer,
  sceneObjects: SceneObject[],
  onSelect: (sceneObject: SceneObject) => void
): Observer<Nullable<AbstractMesh>> {
  return gizmoManager.onAttachedToMeshObservable.add(mesh => {
    if (!mesh) return;
    if (!isSceneEntityName(mesh.name, "object")) return;

    const sceneObjectId = sceneEntityIdFromName(mesh.name, "object");
    const sceneObjectTransformNode = getSceneObjectTransformNode(
      scene,
      sceneObjectId
    );
    if (!sceneObjectTransformNode) return;

    const sceneObject = sceneObjects.find(
      sceneObject => sceneObject.id === sceneObjectId
    );
    if (!sceneObject) return;

    attachSceneObjectSelection(
      gizmoManager,
      selectionOutlineLayer,
      sceneObject,
      sceneObjectTransformNode
    );
    onSelect(sceneObject);
  });
}

/**
 * Resolve the scene object and transform node currently attached to the
 * gizmo, or null if nothing (or a non-scene-object entity) is attached.
 * @param gizmo Gizmo to read the attached node from.
 * @param sceneObjects Experiment scene objects to resolve the attached mesh against.
 */
function attachedSceneObjectFromGizmo(
  gizmo: IGizmo,
  sceneObjects: SceneObject[]
): { sceneObject: SceneObject; node: TransformNode } | null {
  const node = gizmo.attachedNode;
  if (!node || !isSceneEntityName(node.name, "object")) return null;

  const sceneObjectId = sceneEntityIdFromName(node.name, "object");
  const sceneObject = sceneObjects.find(
    sceneObject => sceneObject.id === sceneObjectId
  );
  if (!sceneObject) return null;

  return { sceneObject, node: node as TransformNode };
}

/**
 * Update a scene object's position from a gizmo drag.
 * @param positionGizmo Position gizmo to track dragging on.
 * @param sceneObjects Experiment scene objects to resolve the attached mesh against.
 * @param onDrag Callback invoked with the scene object id the drag is happening to.
 */
export function setSceneObjectPositionFromGizmoDrag(
  positionGizmo: IPositionGizmo,
  sceneObjects: SceneObject[],
  onDrag: (sceneObjectId: string) => void
): Observer<DragEvent> {
  return positionGizmo.onDragObservable.add(() => {
    const attached = attachedSceneObjectFromGizmo(positionGizmo, sceneObjects);
    if (!attached) return;
    stopNodePoseInterpolation(attached.node);
    attached.sceneObject.position = vector3ToAsr(attached.node.position);
    onDrag(attached.sceneObject.id);
  });
}

/**
 * Update a scene object's orientation from a gizmo drag.
 * @param rotationGizmo Rotation gizmo to track dragging on.
 * @param sceneObjects Experiment scene objects to resolve the attached mesh against.
 * @param onDrag Callback invoked with the scene object id the drag is happening to.
 */
export function setSceneObjectRotationFromGizmoDrag(
  rotationGizmo: IRotationGizmo,
  sceneObjects: SceneObject[],
  onDrag: (sceneObjectId: string) => void
): Observer<DragEvent> {
  return rotationGizmo.onDragObservable.add(() => {
    const attached = attachedSceneObjectFromGizmo(rotationGizmo, sceneObjects);
    if (!attached) return;
    stopNodePoseInterpolation(attached.node);
    attached.sceneObject.rotation = vector3ToAsr(attached.node.rotation);
    onDrag(attached.sceneObject.id);
  });
}

/**
 * Callback filter for when dragging finishes on a scene object, from either
 * the position or the rotation gizmo.
 * @param gizmos Position and rotation gizmos to track dragging on.
 * @param onDragEnd Callback invoked to confirm the scene object drag ended.
 */
export function endSceneObjectGizmoDrag(
  gizmos: TransformGizmos,
  onDragEnd: () => void
): Observer<DragStartEndEvent>[] {
  const onEnd = (gizmo: IGizmo) => () => {
    if (!gizmo.attachedNode) return;
    if (!isSceneEntityName(gizmo.attachedNode.name, "object")) return;
    onDragEnd();
  };

  return [
    gizmos.positionGizmo.onDragEndObservable.add(onEnd(gizmos.positionGizmo)),
    gizmos.rotationGizmo.onDragEndObservable.add(onEnd(gizmos.rotationGizmo))
  ];
}
