import type { Scene } from "@babylonjs/core";
import {
  Color3,
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
import { buildReferenceCoordinateNode } from "./reference-coordinate.api";

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

/** Name of the shared grey material used by every probe's rod mesh. */
const ROD_MATERIAL_NAME = "rod_material";

/** Thickness of the extruded shank mesh, in mm. */
const SHANK_THICKNESS_MILLIMETERS = 0.01;

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
 */
export function buildProbe(
  scene: Scene,
  probe: Probe,
  experiment: Experiment
): TransformNode | null {
  const existing = scene.getTransformNodeByName(
    probeEntityName(probe.id, PROBE_NODE_SUFFIX)
  );
  if (existing) return existing;

  const probeInterfaceProbe = getInternedProbeInterfaceProbe(experiment, probe);
  if (!probeInterfaceProbe) return null;

  const contour = buildProbeContour(probeInterfaceProbe);
  if (!contour) return null;

  const node = new TransformNode(
    probeEntityName(probe.id, PROBE_NODE_SUFFIX),
    scene
  );
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

  // const contactsMesh = buildContactsMesh(
  //   scene,
  //   buildContactsBox(probeInterfaceProbe, contour),
  //   probeEntityName(probe.id, CONTACTS_MESH_SUFFIX)
  // );
  // contactsMesh.material = buildContactsMaterial(scene, probe);
  // contactsMesh.parent = node;

  return node;
}

/**
 * Dispose a probe's transform node, its meshes, and its own materials,
 * leaving shared materials (e.g. `rod_material`) untouched.
 * @param scene Scene the probe was built in.
 * @param probeId Probe ID to remove any existing entity for.
 */
export function disposeProbe(scene: Scene, probeId: string): void {
  scene
    .getTransformNodeByName(probeEntityName(probeId, PROBE_NODE_SUFFIX))
    ?.dispose(false, false);
  scene
    .getMaterialByName(probeEntityName(probeId, PROBE_MATERIAL_SUFFIX))
    ?.dispose();
  scene
    .getMaterialByName(probeEntityName(probeId, CONTACTS_MATERIAL_SUFFIX))
    ?.dispose();
}

/**
 * Synchronize the probe entities with their states.
 * @param scene Scene to sync the probes of.
 * @param experiment Experiment to pull probe data to sync from.
 */
export function syncProbes(scene: Scene, experiment: Experiment) {
  // 1. Sync existence.
  const presentProbeIds = new Set(
    buildReferenceCoordinateNode(scene)
      .getChildren(node => node.name.endsWith(PROBE_NODE_SUFFIX))
      .map(node => node.name.slice(0, -PROBE_NODE_SUFFIX.length))
  );
  const experimentProbeIds = new Set(experiment.probes.map(probe => probe.id));

  // Dispose removed probes.
  for (const presentProbeId of presentProbeIds) {
    if (!experimentProbeIds.has(presentProbeId)) {
      disposeProbe(scene, presentProbeId);
    }
  }

  // Add new probes.
  for (const probe of experiment.probes) {
    if (!presentProbeIds.has(probe.id)) {
      buildProbe(scene, probe, experiment);
    }
  }

  // Sync materials.
  // Sync visibility.
}

/**
 * Sync each probe entity to the visibility model.
 * @param scene Scene to modify entities in.
 * @param experiment Experiment with probe models to get visibility from.
 */
export function syncProbeVisibility(scene: Scene, experiment: Experiment) {
  console.log(scene);
  console.log(experiment);
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
 * Build a probe's shank-and-head-stage material, colored from the probe.
 * @param scene Scene to build the material in.
 * @param probe Probe to derive the material's color from.
 */
function buildProbeMaterial(scene: Scene, probe: Probe): StandardMaterial {
  const material = new StandardMaterial(
    probeEntityName(probe.id, PROBE_MATERIAL_SUFFIX),
    scene
  );
  material.diffuseColor = Color3.FromHexString(probe.color);
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
  mesh.position = new Vector3(0, 0, -SHANK_THICKNESS_MILLIMETERS / 2);
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
  const mesh = MeshBuilder.CreateCylinder(
    name,
    {
      height: HEAD_STAGE_HEIGHT_MILLIMETERS,
      diameterBottom: contour.width,
      diameterTop: HEAD_STAGE_TOP_DIAMETER_MILLIMETERS
    },
    scene
  );
  mesh.rotation = new Vector3(Math.PI / 2, 0, 0);
  mesh.position = new Vector3(
    0,
    0,
    contour.height + HEAD_STAGE_HEIGHT_MILLIMETERS / 2
  );
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
 * @param scene Scene to get the rod material from.
 */
function buildRodMaterial(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName(ROD_MATERIAL_NAME);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(ROD_MATERIAL_NAME, scene);
  material.diffuseColor = Color3.Gray();
  return material;
}
