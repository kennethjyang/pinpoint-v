import type { Scene } from "@babylonjs/core";
import { Color3, StandardMaterial } from "@babylonjs/core";
import type { ProbeGhost } from "@/features/probe";
import { asrToVector3 } from "./coordinate-transforms.api";
import { getProbeTransformNode } from "./probe.api";

/** Name of the transform node the ghost's cloned meshes hang off. */
const PROBE_GHOST_NODE_NAME = "probeGhost_node";

/** Name of the shared translucent material every ghost mesh uses. */
const PROBE_GHOST_MATERIAL_NAME = "probeGhost_material";

/** Opacity of the ghost's meshes. */
const PROBE_GHOST_ALPHA = 0.35;

/**
 * Draw or move the translucent probe clone, or strip it when there is no ghost.
 * @param scene Scene holding the probes.
 * @param ghost Ghost to draw, or null to remove it.
 * @param rebuiltProbeIds Probe ids rebuilt this pass, whose ghost must be re-cloned.
 */
export function syncProbeGhost(
  scene: Scene,
  ghost: ProbeGhost | null,
  rebuiltProbeIds: string[]
): void {
  if (!ghost) {
    disposeProbeGhost(scene);
    return;
  }

  const source = getProbeTransformNode(scene, ghost.probeId);
  if (!source) {
    disposeProbeGhost(scene);
    return;
  }

  const existing = scene.getTransformNodeByName(PROBE_GHOST_NODE_NAME);
  const canReuse =
    existing?.metadata === ghost.probeId &&
    !rebuiltProbeIds.includes(ghost.probeId);

  let node = existing;
  if (!canReuse) {
    disposeProbeGhost(scene);
    node = source.clone(PROBE_GHOST_NODE_NAME, source.parent);
    if (!node) return;

    node.metadata = ghost.probeId;
    const material = buildProbeGhostMaterial(scene);
    for (const mesh of node.getChildMeshes()) {
      mesh.material = material;
      mesh.isPickable = false;
      mesh.metadata = null;
    }
  }
  if (!node) return;

  node.position = asrToVector3(ghost.tipPosition);
  node.rotation = asrToVector3(ghost.rotation);
}

/**
 * Dispose the ghost's cloned node, its meshes, and its shared material, if present.
 * @param scene Scene holding the ghost.
 */
export function disposeProbeGhost(scene: Scene): void {
  scene.getTransformNodeByName(PROBE_GHOST_NODE_NAME)?.dispose(false, false);
  scene.getMaterialByName(PROBE_GHOST_MATERIAL_NAME)?.dispose();
}

/**
 * Build the ghost's shared translucent material, or return the existing one.
 * @param scene Scene to build the material in.
 */
function buildProbeGhostMaterial(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName(PROBE_GHOST_MATERIAL_NAME);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(PROBE_GHOST_MATERIAL_NAME, scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.alpha = PROBE_GHOST_ALPHA;
  material.backFaceCulling = false;
  material.needDepthPrePass = true;
  return material;
}
