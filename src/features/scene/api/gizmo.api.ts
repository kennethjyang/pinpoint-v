import type { GizmoManager, IScaleGizmo } from "@babylonjs/core";
import { GizmoCoordinatesMode } from "@babylonjs/core";
import type { GizmoCoordinateSpace, GizmoMode } from "../models/gizmo.model";

/**
 * Configure the gizmo manager for a transform mode: translation and rotation
 * are driven by the transform chain gizmo, so the manager only ever exposes its
 * scale gizmo. Returns that gizmo, or null when it isn't built.
 * @param gizmoManager Gizmo manager to configure.
 * @param mode Transform gizmo the toolbar has active.
 * @param coordinateSpace Axis frame the scale gizmo drags in.
 */
export function setGizmoControls(
  gizmoManager: GizmoManager,
  mode: GizmoMode,
  coordinateSpace: GizmoCoordinateSpace
): IScaleGizmo | null {
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = mode === "scale";

  // Also forces gizmo position tracking, so it follows the mesh in either space.
  gizmoManager.coordinatesMode =
    coordinateSpace === "local"
      ? GizmoCoordinatesMode.Local
      : GizmoCoordinatesMode.World;

  return gizmoManager.gizmos.scaleGizmo ?? null;
}
