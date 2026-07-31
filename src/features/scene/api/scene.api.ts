import type {
  GizmoManager,
  Observer,
  PointerInfo,
  Scene,
  SelectionOutlineLayer
} from "@babylonjs/core";
import { PointerEventTypes } from "@babylonjs/core";

/**
 * Clear a selection in the scene if clicked empty space or a structure mesh.
 *
 * @param scene Scene to clear the selection in.
 * @param gizmoManager Gizmo manager to update.
 * @param selectionOutlineLayer Selection outline to clear.
 * @param onDeselect Callback to let others know a deselect happened.
 */
export function deselectFromPointerDown(
  scene: Scene,
  gizmoManager: GizmoManager,
  selectionOutlineLayer: SelectionOutlineLayer,
  onDeselect: () => void
): Observer<PointerInfo> {
  return scene.onPointerObservable.add(pointerInfo => {
    const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
    if (pickedMesh && !pickedMesh.name.includes("structure")) return;

    gizmoManager.attachToNode(null);
    selectionOutlineLayer.clearSelection();
    onDeselect();
  }, PointerEventTypes.POINTERTAP);
}
