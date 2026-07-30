import type { GizmoManager, Scene } from "@babylonjs/core";
import {
  Color3,
  CSG2,
  ExtrudePolygon,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import earcut from "earcut";
import type { Experiment } from "@/features/experiment";
import { getInternedProbeInterfaceProbe } from "@/features/experiment";
import type { Probe, ProbeInterfaceProbe } from "@/features/probe";
import { getProbeInterfaceIdentifier } from "@/features/probe";
import { setMaterialDiffuseColor } from "./material.api";
import { buildReferenceCoordinateNode } from "./reference-coordinate.api";
import { asrToVector3 } from "../api/coordinate-transforms.api";
import type { ProbeMetadata } from "../models/probe-metadata.model";

/** A probe's planar contour in millimeters, re-origined on its center tip. */
interface ProbeContour {
  /** XoZ-plane points for `ExtrudePolygon`. */
  shape: Vector3[];
  /** Full x extent of the contour, in mm. */
  width: number;
  /** Distance from the center tip to the top of the contour, in mm. */
  height: number;
  /** Offset subtracted from scaled probe-definition coordinates to reach local space, in mm. */
  origin: { x: number; y: number };
}

/** Suffix applied to a probe's id to name its parenting transform node. */
const PROBE_NODE_SUFFIX = "_probe";

/** Suffix applied to a probe's id to name its shank/head-stage material. */
const PROBE_MATERIAL_SUFFIX = "_material";

/** Suffix applied to a probe's id to name its shank mesh. */
const SHANK_MESH_SUFFIX = "_shank_mesh";

/** Suffix applied to a probe's id to name its head stage mesh. */
const HEAD_STAGE_MESH_SUFFIX = "_headStage_mesh";

/** Suffix applied to a probe's id to name its rod mesh. */
const ROD_MESH_SUFFIX = "_rod_mesh";

/** Suffix applied to a probe's id to name its contacts material. */
const CONTACTS_MATERIAL_SUFFIX = "_contacts_material";

/** Name of the shared gray material used by every probe's rod mesh. */
const ROD_MATERIAL_NAME = "rod_material";

/** Thickness of the extruded shank mesh, in mm. */
const SHANK_THICKNESS_MILLIMETERS = 0.05;

/** Height of the head stage cone, in mm. */
const HEAD_STAGE_HEIGHT_MILLIMETERS = 20;

/** Top radius of the head stage cone, in mm. */
const HEAD_STAGE_TOP_DIAMETER_MILLIMETERS = 8;

/** Length of the rod, in mm. */
const ROD_LENGTH_MILLIMETERS = 200;

/** Radius of the rod, in mm. */
const ROD_DIAMETER_MILLIMETERS = 8;

/** Conversion factor to millimeters, keyed by `ProbeInterfaceProbe.si_units`. */
const SI_UNITS_TO_MILLIMETERS: Record<string, number> = {
  m: 1000,
  mm: 1,
  um: 1e-3
};

/** Fallback conversion factor for an unrecognized `si_units` value. */
const MICROMETERS_TO_MILLIMETERS = 1e-3;

/**
 * Build a probe's shank, head stage, and rod meshes under a transform node
 * placed at the probe's center tip and parented to the reference coordinate
 * node, or return the existing entity if the probe was already built.
 * Returns null if the probe has no usable contour to build from.
 * @param scene Scene to add the probe to.
 * @param probe Probe to build.
 * @param experiment Experiment this probe belongs to (to extract probe interface definition).
 * @param gizmoManager Gizmo manager to add probe meshes to.
 */
export function buildProbe(
  scene: Scene,
  probe: Probe,
  experiment: Experiment,
  gizmoManager: GizmoManager
): TransformNode | null {
  const existing = scene.getTransformNodeByName(
    probeEntityName(probe.id, PROBE_NODE_SUFFIX)
  );
  if (existing) return existing;

  const probeInterfaceProbe = getInternedProbeInterfaceProbe(experiment, probe);
  if (!probeInterfaceProbe) return null;

  const contour = buildProbeContour(probeInterfaceProbe);
  if (!contour) return null;

  const probeMetadata: ProbeMetadata = {
    probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe)
  };

  const node = new TransformNode(
    probeEntityName(probe.id, PROBE_NODE_SUFFIX),
    scene
  );
  node.metadata = probeMetadata;
  node.parent = buildReferenceCoordinateNode(scene);

  const material = buildProbeMaterial(scene, probe);
  const shankMesh = buildShankMesh(
    scene,
    contour,
    probeEntityName(probe.id, SHANK_MESH_SUFFIX)
  );
  const headStageMesh = buildHeadStageMesh(
    scene,
    contour,
    probeEntityName(probe.id, HEAD_STAGE_MESH_SUFFIX)
  );
  for (const mesh of [shankMesh, headStageMesh]) {
    mesh.material = material;
    mesh.parent = node;
  }

  const rodMesh = buildRodMesh(
    scene,
    contour,
    probeEntityName(probe.id, ROD_MESH_SUFFIX)
  );
  rodMesh.material = buildRodMaterial(scene);
  rodMesh.parent = node;

  // Enable gizmo picking.
  if (!gizmoManager.attachableMeshes) {
    gizmoManager.attachableMeshes = [];
  }
  gizmoManager.attachableMeshes.push(shankMesh, headStageMesh, rodMesh);

  return node;
}

/**
 * Dispose a probe's transform node, its meshes, and its own materials,
 * leaving shared materials (e.g. `rod_material`) untouched.
 * @param scene Scene the probe was built in.
 * @param probeId Probe ID to remove any existing entity for.
 * @param gizmoManager Gizmo manager to remove probe meshes from.
 */
export function disposeProbe(
  scene: Scene,
  probeId: string,
  gizmoManager: GizmoManager
): void {
  scene
    .getTransformNodeByName(probeEntityName(probeId, PROBE_NODE_SUFFIX))
    ?.dispose(false, false);
  scene
    .getMaterialByName(probeEntityName(probeId, PROBE_MATERIAL_SUFFIX))
    ?.dispose();
  scene
    .getMaterialByName(probeEntityName(probeId, CONTACTS_MATERIAL_SUFFIX))
    ?.dispose();
  gizmoManager.attachableMeshes = gizmoManager.attachableMeshes!.filter(
    mesh => !mesh.name.includes(probeId)
  );
}

/**
 * Synchronize the probe entities with their states.
 * @param scene Scene to sync the probes of.
 * @param experiment Experiment to pull probe data to sync from.
 * @param gizmoManager Gizmo manager for controlling probes.
 */
export function syncProbes(
  scene: Scene,
  experiment: Experiment,
  gizmoManager: GizmoManager
) {
  const referenceCoordinateNode = buildReferenceCoordinateNode(scene);
  const experimentProbesById = new Map(
    experiment.probes.map(probe => [probe.id, probe])
  );

  // Reconcile existence and type in a single pass: keep nodes that still
  // match a probe, dispose removed or stale-typed ones.
  const nodesById = new Map<string, TransformNode>();
  for (const node of referenceCoordinateNode.getChildren(child =>
    child.name.endsWith(PROBE_NODE_SUFFIX)
  ) as TransformNode[]) {
    const id = probeIdFromEntityName(node.name, PROBE_NODE_SUFFIX);
    const { probeInterfaceIdentifier } = node.metadata as ProbeMetadata;
    const probe = experimentProbesById.get(id);
    if (!probe || probe.probeInterfaceIdentifier !== probeInterfaceIdentifier) {
      disposeProbe(scene, id, gizmoManager);
      continue;
    }
    nodesById.set(id, node);
  }

  // Sync experiment probes.
  for (const probe of experiment.probes) {
    // Get or build probe.
    const node =
      nodesById.get(probe.id) ??
      buildProbe(scene, probe, experiment, gizmoManager);
    if (!node) continue;

    const meshes = node.getChildMeshes(false);
    const shankMesh = meshes.find(mesh =>
      mesh.name.endsWith(SHANK_MESH_SUFFIX)
    );
    const headStageMesh = meshes.find(mesh =>
      mesh.name.endsWith(HEAD_STAGE_MESH_SUFFIX)
    );
    const rodMesh = meshes.find(mesh => mesh.name.endsWith(ROD_MESH_SUFFIX));

    // Update material color.
    const material = shankMesh?.material;
    if (material instanceof StandardMaterial) {
      setMaterialDiffuseColor(material, Color3.FromHexString(probe.color));
    }

    // Update visibility.
    switch (probe.visibility) {
      case "visible":
        shankMesh?.setEnabled(true);
        headStageMesh?.setEnabled(true);
        rodMesh?.setEnabled(true);
        break;
      case "shanks":
        shankMesh?.setEnabled(true);
        headStageMesh?.setEnabled(false);
        rodMesh?.setEnabled(false);
        break;
      case "hidden":
      default:
        shankMesh?.setEnabled(false);
        headStageMesh?.setEnabled(false);
        rodMesh?.setEnabled(false);
        break;
    }

    // Update transform.
    node.setPositionWithLocalVector(asrToVector3(probe.tipPosition));
    node.rotation = asrToVector3(probe.orientation);
  }
}

/**
 * Reduce a probe interface definition's planar contour to millimeters,
 * re-origined on its center tip. Returns null if the contour is missing or
 * has too few usable points.
 * @param probeInterfaceProbe Probe interface definition to extract the contour from.
 */
function buildProbeContour(
  probeInterfaceProbe: ProbeInterfaceProbe
): ProbeContour | null {
  const contour = probeInterfaceProbe.probe_planar_contour;
  if (!contour) return null;

  const scale = millimetersPerUnit(probeInterfaceProbe);

  const points: { x: number; y: number }[] = [];
  for (const point of contour) {
    const [x, y] = point;
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x: x * scale, y: y * scale });
  }
  if (points.length < 3) return null;

  let minimumX = points[0]!.x;
  let maximumX = minimumX;
  let minimumY = points[0]!.y;
  let maximumY = minimumY;
  for (const { x, y } of points) {
    if (x < minimumX) minimumX = x;
    if (x > maximumX) maximumX = x;
    if (y < minimumY) minimumY = y;
    if (y > maximumY) maximumY = y;
  }

  const centerX = (minimumX + maximumX) / 2;
  return {
    shape: points.map(({ x, y }) => new Vector3(x - centerX, 0, y - minimumY)),
    width: maximumX - minimumX,
    height: maximumY - minimumY,
    origin: { x: centerX, y: minimumY }
  };
}

/**
 * Millimeters per unit of a probe interface definition's `si_units`.
 * @param probeInterfaceProbe Probe interface definition to derive the scale from.
 */
function millimetersPerUnit(probeInterfaceProbe: ProbeInterfaceProbe): number {
  return (
    SI_UNITS_TO_MILLIMETERS[probeInterfaceProbe.si_units] ??
    MICROMETERS_TO_MILLIMETERS
  );
}

/**
 * Babylon name for one of a probe's entities, derived from its id.
 * @param probeId Probe id to derive the name from.
 * @param suffix Suffix identifying the kind of entity.
 */
function probeEntityName(probeId: string, suffix: string): string {
  return `${probeId}${suffix}`;
}

/**
 * Recover a probe's id from one of its entity names.
 * @param entityName Entity name produced by {@link probeEntityName}.
 * @param suffix Suffix the entity name was built with.
 */
function probeIdFromEntityName(entityName: string, suffix: string): string {
  return entityName.slice(0, -suffix.length);
}

/**
 * Build a probe's shank-and-head-stage material, colored from the probe.
 * Frozen immediately, before any mesh uses it, so its later color updates
 * (via {@link setMaterialDiffuseColor}) rely on being forced through rather
 * than on the material being unfrozen.
 * @param scene Scene to build the material in.
 * @param probe Probe to derive the material's color from.
 */
function buildProbeMaterial(scene: Scene, probe: Probe): StandardMaterial {
  const material = new StandardMaterial(
    probeEntityName(probe.id, PROBE_MATERIAL_SUFFIX),
    scene
  );
  material.diffuseColor = Color3.FromHexString(probe.color);
  material.freeze();
  return material;
}

/**
 * Extrude the probe's contour into a thin shank mesh standing up in the XY
 * plane, tip at the origin.
 * @param scene Scene to build the mesh in.
 * @param contour Probe contour to extrude.
 * @param name Name for the mesh.
 */
function buildShankMesh(
  scene: Scene,
  contour: ProbeContour,
  name: string
): Mesh {
  const mesh = ExtrudePolygon(
    name,
    {
      shape: contour.shape,
      depth: SHANK_THICKNESS_MILLIMETERS,
      sideOrientation: Mesh.DOUBLESIDE
    },
    scene,
    earcut
  );
  mesh.position = new Vector3(0, SHANK_THICKNESS_MILLIMETERS / 2, 0);
  return mesh;
}

/**
 * Build the truncated cone ("head stage") sitting on top of the probe's
 * shanks, as wide as the contour at its base.
 * @param scene Scene to build the mesh in.
 * @param contour Probe contour the head stage sits on top of.
 * @param name Name for the mesh.
 */
function buildHeadStageMesh(
  scene: Scene,
  contour: ProbeContour,
  name: string
): Mesh {
  // noinspection JSSuspiciousNameCombination
  const baseMesh = MeshBuilder.CreateCylinder(
    `${name}_base`,
    {
      height: HEAD_STAGE_HEIGHT_MILLIMETERS,
      diameterBottom: contour.width,
      diameterTop: HEAD_STAGE_TOP_DIAMETER_MILLIMETERS
    },
    scene
  );
  baseMesh.rotation = new Vector3(Math.PI / 2, 0, 0);
  baseMesh.position = new Vector3(
    0,
    0,
    contour.height + HEAD_STAGE_HEIGHT_MILLIMETERS / 2
  );
  const cutterMesh = MeshBuilder.CreateBox(`${name}_cutter`, {
    size: HEAD_STAGE_TOP_DIAMETER_MILLIMETERS,
    height: HEAD_STAGE_HEIGHT_MILLIMETERS
  });
  cutterMesh.position = new Vector3(
    0,
    -HEAD_STAGE_HEIGHT_MILLIMETERS / 8,
    HEAD_STAGE_TOP_DIAMETER_MILLIMETERS / 2 + SHANK_THICKNESS_MILLIMETERS / 2
  );
  cutterMesh.parent = baseMesh;

  // Subtract cutter.
  const baseCSG = CSG2.FromMesh(baseMesh);
  const cutterCSG = CSG2.FromMesh(cutterMesh);
  const resultCSG = baseCSG.subtract(cutterCSG);
  const mesh = resultCSG.toMesh(name, scene, { rebuildNormals: true });
  mesh.position = new Vector3(
    0,
    0,
    contour.height + HEAD_STAGE_HEIGHT_MILLIMETERS / 2
  );

  // Cleanup base mesh and CSG manifolds (not GC'd; wrap native WASM memory).
  baseMesh.dispose();
  baseCSG.dispose();
  cutterCSG.dispose();
  resultCSG.dispose();

  return mesh;
}

/**
 * Build the rod sitting on top of the probe's head stage.
 * @param scene Scene to build the mesh in.
 * @param contour Probe contour the head stage (and rod) sit on top of.
 * @param name Name for the mesh.
 */
function buildRodMesh(scene: Scene, contour: ProbeContour, name: string): Mesh {
  const mesh = MeshBuilder.CreateCylinder(
    name,
    {
      height: ROD_LENGTH_MILLIMETERS,
      diameter: ROD_DIAMETER_MILLIMETERS
    },
    scene
  );
  mesh.rotation = new Vector3(Math.PI / 2, 0, 0);
  mesh.position = new Vector3(
    0,
    0,
    contour.height + HEAD_STAGE_HEIGHT_MILLIMETERS + ROD_LENGTH_MILLIMETERS / 2
  );
  return mesh;
}

/**
 * Build the scene's shared grey rod material, or return the existing one.
 * Frozen once, only on creation: nothing ever mutates it afterward, and
 * re-freezing an already-frozen shared material on every reuse would clear
 * a pending forced rebind on every rod mesh in the scene.
 * @param scene Scene to get the rod material from.
 */
function buildRodMaterial(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName(ROD_MATERIAL_NAME);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(ROD_MATERIAL_NAME, scene);
  material.diffuseColor = Color3.Gray();
  material.freeze();
  return material;
}
