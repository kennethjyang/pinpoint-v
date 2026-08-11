import type { Scene } from "@babylonjs/core";
import { Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { Probe, ProbeSurfaceMarker } from "@/features/probe";
import { asrToVector3 } from "./coordinate-transforms.api";
import { setMaterialEmissiveColor } from "./material.api";
import { buildAtlasRootNode } from "./structures.api";

/** Name of the surface marker's sphere mesh. */
const PROBE_SURFACE_MARKER_MESH_NAME = "probeSurfaceMarker_mesh";
/** Name of the surface marker's material. */
const PROBE_SURFACE_MARKER_MATERIAL_NAME = "probeSurfaceMarker_material";
/** Diameter of the surface marker's sphere, in mm. */
const PROBE_SURFACE_MARKER_DIAMETER_MILLIMETERS = 1;
/** Latitude and longitude segments of the surface marker's sphere. */
const PROBE_SURFACE_MARKER_SEGMENTS = 12;

/**
 * Draw or move the on-surface node's marker sphere, or strip it when there is no marker.
 * @param scene Scene to draw the marker in.
 * @param marker Marker to draw, or null to remove it.
 * @param probes Probes in the experiment, to resolve the marker's own color and visibility.
 */
export function syncProbeSurfaceMarker(
  scene: Scene,
  marker: ProbeSurfaceMarker | null,
  probes: Probe[]
): void {
  const probe = marker
    ? probes.find(({ id }) => id === marker.probeId)
    : undefined;
  if (!marker || !probe || probe.visibility === "hidden") {
    disposeProbeSurfaceMarker(scene);
    return;
  }

  const mesh =
    scene.getMeshByName(PROBE_SURFACE_MARKER_MESH_NAME) ??
    MeshBuilder.CreateSphere(
      PROBE_SURFACE_MARKER_MESH_NAME,
      {
        diameter: PROBE_SURFACE_MARKER_DIAMETER_MILLIMETERS,
        segments: PROBE_SURFACE_MARKER_SEGMENTS
      },
      scene
    );
  mesh.parent = buildAtlasRootNode(scene);
  mesh.isPickable = false;

  const material = buildProbeSurfaceMarkerMaterial(scene);
  setMaterialEmissiveColor(material, Color3.FromHexString(probe.color));
  mesh.material = material;

  mesh.position = asrToVector3(marker.position);
}

/**
 * Dispose the marker's sphere and its material, if present.
 * @param scene Scene holding the marker.
 */
function disposeProbeSurfaceMarker(scene: Scene): void {
  scene.getMeshByName(PROBE_SURFACE_MARKER_MESH_NAME)?.dispose();
  scene.getMaterialByName(PROBE_SURFACE_MARKER_MATERIAL_NAME)?.dispose();
}

/**
 * Build the marker's shared unlit emissive material, or return the existing one.
 * @param scene Scene to build the material in.
 */
function buildProbeSurfaceMarkerMaterial(scene: Scene): StandardMaterial {
  const existing = scene.getMaterialByName(PROBE_SURFACE_MARKER_MATERIAL_NAME);
  if (existing instanceof StandardMaterial) return existing;

  const material = new StandardMaterial(
    PROBE_SURFACE_MARKER_MATERIAL_NAME,
    scene
  );
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  return material;
}
