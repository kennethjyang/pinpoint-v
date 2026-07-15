import { ArcRotateCamera, Scene } from "@babylonjs/core";

/**
 * Set the zoom of the camera.
 * @param radius Distance from the center point (zoom).
 * @param scene Scene to modify the camera of.
 */
export function setZoom(radius: number, scene: Scene) {
  // Exit if we don't have an active arc rotate camera.
  if (
    !scene.activeCamera ||
    scene.activeCamera.getClassName() !== "ArcRotateCamera"
  )
    return;

  const camera = scene.activeCamera as ArcRotateCamera;
  camera.radius = radius;
}
