import { describe, expect, it } from "vitest";
import type { ArcRotateCamera } from "@babylonjs/core";
import { setZoom } from "./camera.api";

describe("setZoom", () => {
  it("sets radius on the camera", () => {
    const camera = { radius: 0 } as ArcRotateCamera;

    setZoom(42, camera);

    expect(camera.radius).toBe(42);
  });
});
