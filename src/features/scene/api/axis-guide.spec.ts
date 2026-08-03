import { describe, expect, it } from "vitest";
import type { StandardMaterial } from "@babylonjs/core";
import { Color3, Vector3 } from "@babylonjs/core";
import { makeTestScene } from "@/test/mount-helper";
import { makeManifest } from "@/test/fixtures";
import { buildAxisGuides } from "./axis-guide.api";
import { asrToVector3 } from "./coordinate-transforms.api";

const AXIS_GUIDE_MESH_NAMES = [
  "apPositive_axisGuide_mesh",
  "apNegative_axisGuide_mesh",
  "dvPositive_axisGuide_mesh",
  "dvNegative_axisGuide_mesh",
  "mlPositive_axisGuide_mesh",
  "mlNegative_axisGuide_mesh"
];

/**
 * Assert two Babylon vectors are componentwise close, tolerating float
 * error from ASR-axis addition.
 * @param actual Vector produced by the code under test.
 * @param expected Vector to compare against.
 */
function expectVectorCloseTo(
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number }
): void {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
}

describe("buildAxisGuides", () => {
  it("builds six labels parented to axisGuideRoot_node under atlasRoot_node", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    const root = scene.getTransformNodeByName("axisGuideRoot_node")!;
    expect(root).toBeTruthy();
    expect(root.parent?.name).toBe("atlasRoot_node");

    const names = [
      "apPositive_axisGuide_mesh",
      "apNegative_axisGuide_mesh",
      "dvPositive_axisGuide_mesh",
      "dvNegative_axisGuide_mesh",
      "mlPositive_axisGuide_mesh",
      "mlNegative_axisGuide_mesh"
    ];
    for (const name of names) {
      const mesh = scene.getMeshByName(name)!;
      expect(mesh).toBeTruthy();
      expect(mesh.parent).toBe(root);
    }
  });

  it("positions each label one atlas dimension away from the atlas center", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    const apPositive = scene.getMeshByName("apPositive_axisGuide_mesh")!;
    const apNegative = scene.getMeshByName("apNegative_axisGuide_mesh")!;
    const dvPositive = scene.getMeshByName("dvPositive_axisGuide_mesh")!;
    const mlPositive = scene.getMeshByName("mlPositive_axisGuide_mesh")!;

    expectVectorCloseTo(apPositive.position, asrToVector3([19.8, 4, 5.7]));
    expectVectorCloseTo(apNegative.position, asrToVector3([-6.6, 4, 5.7]));
    expectVectorCloseTo(dvPositive.position, asrToVector3([6.6, 12, 5.7]));
    expectVectorCloseTo(mlPositive.position, asrToVector3([6.6, 4, 17.1]));
  });

  it("extrudes each label to 5% of the atlas's ML length", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    for (const name of AXIS_GUIDE_MESH_NAMES) {
      const mesh = scene.getMeshByName(name)!;
      const extent = mesh.getBoundingInfo().boundingBox.extendSize.z * 2;
      expect(extent).toBeCloseTo(0.57, 2);
    }
  });

  it("sizes labels so none exceeds half the atlas's ML length, and the widest is close to it", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    let maxWidth = 0;
    for (const name of AXIS_GUIDE_MESH_NAMES) {
      const mesh = scene.getMeshByName(name)!;
      const width = mesh.getBoundingInfo().boundingBox.extendSize.x * 2;
      expect(width).toBeLessThanOrEqual(5.7);
      maxWidth = Math.max(maxWidth, width);
    }
    expect(maxWidth).toBeGreaterThan(5.7 * 0.95);
  });

  it("centers each label's geometry on its own local origin", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    for (const name of AXIS_GUIDE_MESH_NAMES) {
      const mesh = scene.getMeshByName(name)!;
      const center = mesh.getBoundingInfo().boundingBox.center;
      expect(center.x).toBeCloseTo(0, 1);
      expect(center.y).toBeCloseTo(0, 1);
      expect(center.z).toBeCloseTo(0, 1);
    }
  });

  it("faces each label's readable side outward along its own signed axis", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    // A zero-rotation `CreateText` mesh reads correctly when viewed from its
    // local -Z side, so that direction, carried into world space, must point
    // along the label's own axis and sign for the label to be legible to a
    // viewer orbiting toward it.
    const worldAxis: Record<"ap" | "dv" | "ml", "x" | "y" | "z"> = {
      ap: "z",
      dv: "y",
      ml: "x"
    };
    const cases: [string, "ap" | "dv" | "ml", 1 | -1][] = [
      ["apPositive_axisGuide_mesh", "ap", 1],
      ["apNegative_axisGuide_mesh", "ap", -1],
      ["dvPositive_axisGuide_mesh", "dv", 1],
      ["dvNegative_axisGuide_mesh", "dv", -1],
      ["mlPositive_axisGuide_mesh", "ml", 1],
      ["mlNegative_axisGuide_mesh", "ml", -1]
    ];
    for (const [name, axis, sign] of cases) {
      const mesh = scene.getMeshByName(name)!;
      mesh.computeWorldMatrix(true);
      const readableDirection = Vector3.TransformNormal(
        new Vector3(0, 0, -1),
        mesh.getWorldMatrix()
      );
      expect(readableDirection[worldAxis[axis]]).toBeCloseTo(sign);
    }
  });

  it("colors each axis's pair with a shared frozen unlit material", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    const apPositive = scene.getMeshByName("apPositive_axisGuide_mesh")!;
    const apNegative = scene.getMeshByName("apNegative_axisGuide_mesh")!;
    expect(apPositive.material).toBe(apNegative.material);

    const material = apPositive.material as StandardMaterial;
    expect(material.name).toBe("axisGuideAp_material");
    expect(material.emissiveColor.equals(Color3.Blue())).toBe(true);
    expect(material.disableLighting).toBe(true);
    expect(material.isFrozen).toBe(true);

    const dvMaterial = scene.getMeshByName("dvPositive_axisGuide_mesh")!
      .material as StandardMaterial;
    expect(dvMaterial.emissiveColor.equals(Color3.Green())).toBe(true);

    const mlMaterial = scene.getMeshByName("mlPositive_axisGuide_mesh")!
      .material as StandardMaterial;
    expect(mlMaterial.emissiveColor.equals(Color3.Red())).toBe(true);
  });

  it("makes every label unpickable", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());

    for (const name of AXIS_GUIDE_MESH_NAMES) {
      expect(scene.getMeshByName(name)!.isPickable).toBe(false);
    }
  });

  it("rebuilds idempotently, reusing the same materials", () => {
    const scene = makeTestScene();

    buildAxisGuides(scene, makeManifest());
    const materialsBefore = AXIS_GUIDE_MESH_NAMES.map(
      name => scene.getMeshByName(name)!.material
    );

    buildAxisGuides(scene, makeManifest());

    expect(
      scene.transformNodes.filter(node => node.name === "axisGuideRoot_node")
    ).toHaveLength(1);
    const meshesAfter = AXIS_GUIDE_MESH_NAMES.map(name =>
      scene.getMeshByName(name)
    );
    expect(meshesAfter.every(mesh => mesh !== null)).toBe(true);
    const materialsAfter = AXIS_GUIDE_MESH_NAMES.map(
      name => scene.getMeshByName(name)!.material
    );
    expect(materialsAfter).toEqual(materialsBefore);
  });

  it("builds nothing and clears any existing guides for an unknown manifest", () => {
    const scene = makeTestScene();
    buildAxisGuides(scene, makeManifest());
    expect(scene.getTransformNodeByName("axisGuideRoot_node")).toBeTruthy();

    buildAxisGuides(scene, makeManifest({ resolutions: [] }));

    expect(scene.getTransformNodeByName("axisGuideRoot_node")).toBeNull();
  });
});
