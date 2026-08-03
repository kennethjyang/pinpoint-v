import {
  Color3,
  CreateText,
  Matrix,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import earcut from "earcut";
import type { Manifest } from "@/features/atlas";
import {
  getAtlasCenter,
  getAtlasDimensionsMillimeters
} from "@/features/atlas";
import { asrToVector3 } from "./coordinate-transforms.api";
import { buildAtlasRootNode } from "./structures.api";
import { AXIS_GUIDE_FONT } from "../models/axis-guide-font.model";

/** Atlas axis an axis guide marks. */
type AxisGuideAxis = "ap" | "dv" | "ml";

/** One axis guide: which axis, which end, its label, and its local rotation. */
interface AxisGuideSpec {
  axis: AxisGuideAxis;
  sign: 1 | -1;
  text: string;
  /** Local euler rotation, aiming the readable face outward along the axis. */
  rotation: [number, number, number];
}

const AXIS_GUIDE_ROOT_NODE_NAME = "axisGuideRoot_node";

/** Index of each axis in an ASR coordinate triple. */
const AXIS_GUIDE_ASR_INDEX: Record<AxisGuideAxis, 0 | 1 | 2> = {
  ap: 0,
  dv: 1,
  ml: 2
};

/** Material name per axis. */
const AXIS_GUIDE_MATERIAL_NAMES: Record<AxisGuideAxis, string> = {
  ap: "axisGuideAp_material",
  dv: "axisGuideDv_material",
  ml: "axisGuideMl_material"
};

/**
 * The six guides. A zero-rotation `CreateText` mesh reads correctly from its
 * local -Z side; each rotation turns that face outward along its axis once
 * composed with the atlas root's own 180°-about-X parent rotation, which
 * negates Y and Z (but not X) -- so the AP/DV rotations below are each
 * other's mirror image, while ML's X-axis target is parent-invariant and
 * needs no such compensation.
 */
const AXIS_GUIDE_SPECS: AxisGuideSpec[] = [
  { axis: "ap", sign: 1, text: "+AP", rotation: [0, 0, 0] },
  { axis: "ap", sign: -1, text: "-AP", rotation: [0, Math.PI, 0] },
  { axis: "dv", sign: 1, text: "+DV", rotation: [-Math.PI / 2, 0, 0] },
  { axis: "dv", sign: -1, text: "-DV", rotation: [Math.PI / 2, 0, 0] },
  { axis: "ml", sign: 1, text: "+ML", rotation: [0, -Math.PI / 2, 0] },
  { axis: "ml", sign: -1, text: "-ML", rotation: [0, Math.PI / 2, 0] }
];

/** Widest label's advance width, as a fraction of the atlas's ML length. */
const AXIS_GUIDE_WIDTH_ML_FRACTION = 0.5;

/** Extrusion depth, as a fraction of the atlas's ML length. */
const AXIS_GUIDE_DEPTH_ML_FRACTION = 0.05;

/** Points per glyph curve segment (Babylon's `CreateText` default). */
const AXIS_GUIDE_CURVE_RESOLUTION = 8;

/**
 * Rebuild the atlas's six axis guide labels, replacing any existing ones.
 * @param scene Scene to build the axis guides in.
 * @param manifest Manifest supplying the atlas's center and dimensions.
 */
export function buildAxisGuides(scene: Scene, manifest: Manifest): void {
  removeAxisGuides(scene);

  const dimensions = getAtlasDimensionsMillimeters(manifest);
  const mlLength = dimensions[AXIS_GUIDE_ASR_INDEX.ml];
  if (mlLength === 0) return;

  const root = new TransformNode(AXIS_GUIDE_ROOT_NODE_NAME, scene);
  root.parent = buildAtlasRootNode(scene);

  const center = getAtlasCenter(manifest);
  const size = axisGuideLabelSize(mlLength);
  const depth = mlLength * AXIS_GUIDE_DEPTH_ML_FRACTION;

  for (const spec of AXIS_GUIDE_SPECS) {
    const mesh = CreateText(
      axisGuideMeshName(spec),
      spec.text,
      AXIS_GUIDE_FONT,
      { size, depth, resolution: AXIS_GUIDE_CURVE_RESOLUTION },
      scene,
      earcut
    );
    if (!mesh) continue;

    mesh.bakeTransformIntoVertices(
      Matrix.Translation(0, -mesh.getBoundingInfo().boundingBox.center.y, 0)
    );
    mesh.parent = root;

    const index = AXIS_GUIDE_ASR_INDEX[spec.axis];
    const position: [number, number, number] = [...center];
    position[index] += spec.sign * dimensions[index];
    mesh.position = asrToVector3(position);

    mesh.rotation = new Vector3(...spec.rotation);
    mesh.material = buildAxisGuideMaterial(scene, spec.axis);
    mesh.isPickable = false;
  }
}

/**
 * Dispose the axis guide root and its label meshes, if built.
 * @param scene Scene to remove the axis guides from.
 */
function removeAxisGuides(scene: Scene): void {
  scene.getTransformNodeByName(AXIS_GUIDE_ROOT_NODE_NAME)?.dispose();
}

/** Babylon mesh name for an axis guide, e.g. `apPositive_axisGuide_mesh`. */
function axisGuideMeshName(spec: AxisGuideSpec): string {
  return `${spec.axis}${spec.sign > 0 ? "Positive" : "Negative"}_axisGuide_mesh`;
}

/**
 * Glyph size making the widest label exactly half the atlas's ML length wide.
 * @param mlLength Atlas ML extent in mm.
 */
function axisGuideLabelSize(mlLength: number): number {
  const widest = Math.max(
    ...AXIS_GUIDE_SPECS.map(spec => advanceWidth(spec.text))
  );
  return (
    (mlLength * AXIS_GUIDE_WIDTH_ML_FRACTION * AXIS_GUIDE_FONT.resolution) /
    widest
  );
}

/**
 * Sum of glyph advance widths for a label's text, in font units.
 * @param text Label text to measure.
 */
function advanceWidth(text: string): number {
  return Array.from(text).reduce(
    (total, char) => total + (AXIS_GUIDE_FONT.glyphs[char]?.ha ?? 0),
    0
  );
}

/**
 * Build an axis's frozen unlit guide material, or return the existing one.
 * @param scene Scene to build the material in.
 * @param axis Axis the material colors.
 */
function buildAxisGuideMaterial(
  scene: Scene,
  axis: AxisGuideAxis
): StandardMaterial {
  const name = AXIS_GUIDE_MATERIAL_NAMES[axis];
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(name, scene);
  material.emissiveColor = axisGuideColor(axis);
  material.disableLighting = true;
  material.freeze();
  return material;
}

/** Axis guide color: AP blue, DV green, ML red (matching Babylon's gizmo axes). */
function axisGuideColor(axis: AxisGuideAxis): Color3 {
  switch (axis) {
    case "ap":
      return Color3.Blue();
    case "dv":
      return Color3.Green();
    case "ml":
      return Color3.Red();
  }
}
