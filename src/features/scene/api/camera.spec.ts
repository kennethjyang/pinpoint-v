import { describe, it, expect } from "vitest";
import type { Scene } from "@babylonjs/core";
import { setZoom } from "./camera.api";

/**
 * Build a minimal Scene-shaped stub. `setZoom` only ever reads
 * `scene.activeCamera`, so that's all that needs to be faked.
 */
function makeScene(activeCamera: Scene["activeCamera"]): Scene {
  return { activeCamera } as Scene;
}

describe("setZoom", () => {
  it("does nothing when there is no active camera", () => {
    const scene = makeScene(null);

    expect(() => setZoom(10, scene)).not.toThrow();
    expect(scene.activeCamera).toBeNull();
  });

  it("does nothing when the active camera isn't an ArcRotateCamera", () => {
    const camera = {
      getClassName: () => "FreeCamera",
      radius: 0
    };
    const scene = makeScene(camera as unknown as Scene["activeCamera"]);

    setZoom(10, scene);

    expect(camera.radius).toBe(0);
  });

  it("sets radius on an ArcRotateCamera", () => {
    const camera = {
      getClassName: () => "ArcRotateCamera",
      radius: 0
    };
    const scene = makeScene(camera as unknown as Scene["activeCamera"]);

    setZoom(42, scene);

    expect(camera.radius).toBe(42);
  });
});
