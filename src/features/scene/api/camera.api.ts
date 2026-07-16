import { ArcRotateCamera } from "@babylonjs/core";

/**
 * Set the zoom of the camera.
 * @param radius Distance from the center point (zoom).
 * @param camera Scene to modify the camera of.
 */
export function setZoom(radius: number, camera: ArcRotateCamera) {
  camera.radius = radius;
}
