import { describe, expect, it } from "vitest";
import { GizmoCoordinatesMode, GizmoManager } from "@babylonjs/core";
import { makeTestScene, makeTestSceneWithGizmo } from "@/test/mount-helper";
import { setGizmoControls } from "./gizmo.api";

describe("setGizmoControls", () => {
  it("enables only the scale gizmo in scale mode and returns it", () => {
    const { gizmoManager } = makeTestSceneWithGizmo();

    const scaleGizmo = setGizmoControls(gizmoManager, "scale", "local");

    expect(gizmoManager.positionGizmoEnabled).toBe(false);
    expect(gizmoManager.rotationGizmoEnabled).toBe(false);
    expect(gizmoManager.scaleGizmoEnabled).toBe(true);
    expect(scaleGizmo).toBe(gizmoManager.gizmos.scaleGizmo);
  });

  it("leaves every manager gizmo disabled in position and rotation mode", () => {
    const { gizmoManager } = makeTestSceneWithGizmo();

    for (const mode of ["position", "rotation"] as const) {
      setGizmoControls(gizmoManager, mode, "local");

      expect(gizmoManager.positionGizmoEnabled).toBe(false);
      expect(gizmoManager.rotationGizmoEnabled).toBe(false);
      expect(gizmoManager.scaleGizmoEnabled).toBe(false);
    }
  });

  it("returns null in position and rotation mode, which build no scale gizmo", () => {
    const scene = makeTestScene();
    const gizmoManager = new GizmoManager(scene);

    expect(setGizmoControls(gizmoManager, "position", "local")).toBeNull();
    expect(setGizmoControls(gizmoManager, "rotation", "local")).toBeNull();
    expect(gizmoManager.gizmos.scaleGizmo).toBeFalsy();
  });

  it("sets the coordinates mode from the coordinate space", () => {
    const scene = makeTestScene();
    const gizmoManager = new GizmoManager(scene);

    setGizmoControls(gizmoManager, "position", "local");
    expect(gizmoManager.coordinatesMode).toBe(GizmoCoordinatesMode.Local);

    setGizmoControls(gizmoManager, "position", "global");
    expect(gizmoManager.coordinatesMode).toBe(GizmoCoordinatesMode.World);
  });
});
