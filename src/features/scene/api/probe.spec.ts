import { describe, expect, it } from "vitest";
import type { Scene, StandardMaterial } from "@babylonjs/core";
import { Color3 } from "@babylonjs/core";
import type { Experiment } from "@/features/experiment";
import {
  addProbe,
  buildExperiment,
  internProbeInterfaceProbe
} from "@/features/experiment";
import type { Probe } from "@/features/probe";
import { getProbeInterfaceIdentifier } from "@/features/probe";
import { makeAtlas, makeProbe, makeProbeInterfaceProbe } from "@/test/fixtures";
import { makeTestScene } from "@/test/mount-helper";
import { buildProbe } from "./probe.api";

/** Single-shank contour (imec NP1000), in micrometers. */
const NP1000_CONTOUR = [
  [-11, 9989],
  [-11, -11],
  [24, -220],
  [59, -11],
  [59, 9989]
];

/** Four-shank contour (imec NP2020), in micrometers. */
const NP2020_CONTOUR = [
  [-27, 9989],
  [-27, -11],
  [8, -217],
  [43, -11],
  [43, 9989],
  [223, 9989],
  [223, -11],
  [258, -217],
  [293, -11],
  [293, 9989],
  [473, 9989],
  [473, -11],
  [508, -217],
  [543, -11],
  [543, 9989],
  [723, 9989],
  [723, -11],
  [758, -217],
  [793, -11],
  [793, 9989]
];

/**
 * Build an experiment with a single interned probe interface definition and
 * a probe referencing it.
 */
function makeExperimentWithProbe(
  probeOverrides: Partial<Probe> = {},
  probeInterfaceOverrides: Partial<
    Parameters<typeof makeProbeInterfaceProbe>[0]
  > = {}
): { experiment: Experiment; probe: Probe } {
  const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
  const probeInterfaceProbe = makeProbeInterfaceProbe({
    probe_planar_contour: NP1000_CONTOUR,
    ...probeInterfaceOverrides
  });
  internProbeInterfaceProbe(experiment, probeInterfaceProbe);

  const probe = makeProbe({
    probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe),
    ...probeOverrides
  });
  addProbe(experiment, probe);

  return { experiment, probe };
}

/** Shank, head stage, and rod mesh names for a probe. */
function probeMeshNames(probeId: string) {
  return {
    shank: `${probeId}_shank_mesh`,
    headStage: `${probeId}_headStage_mesh`,
    rod: `${probeId}_rod_mesh`
  };
}

/** Round every component of a bounding box's min/max to a fixed precision. */
function roundedBounds(scene: Scene, meshName: string) {
  const mesh = scene.getMeshByName(meshName)!;
  mesh.computeWorldMatrix(true);
  const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox;
  const round = (n: number) => Math.round(n * 1e6) / 1e6 || 0;
  return {
    min: [round(minimumWorld.x), round(minimumWorld.y), round(minimumWorld.z)],
    max: [round(maximumWorld.x), round(maximumWorld.y), round(maximumWorld.z)]
  };
}

/**
 * Sum of triangle areas in a mesh's local extrusion cap (local y ≈ 0),
 * halved because `DOUBLESIDE` duplicates the cap's vertices back-to-back.
 */
function capTriangleArea(scene: Scene, meshName: string): number {
  const mesh = scene.getMeshByName(meshName)!;
  const positions = mesh.getVerticesData("position")!;
  const indices = mesh.getIndices()!;

  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const vertexIndices = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
    const points = vertexIndices.map(index => ({
      x: positions[index * 3]!,
      y: positions[index * 3 + 1]!,
      z: positions[index * 3 + 2]!
    }));
    if (points.some(point => Math.abs(point.y) > 1e-9)) continue;

    const [a, b, c] = points;
    area +=
      Math.abs((b!.x - a!.x) * (c!.z - a!.z) - (c!.x - a!.x) * (b!.z - a!.z)) /
      2;
  }
  return area / 2;
}

describe("buildProbe", () => {
  it("builds a transform node with the shank, head stage, and rod meshes parented under it", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    const node = buildProbe(scene, probe, experiment);

    expect(node).not.toBeNull();
    expect(node!.name).toBe(`${probe.id}_probe`);

    const names = probeMeshNames(probe.id);
    const children = node!.getChildMeshes().map(mesh => mesh.name);
    expect(children).toHaveLength(3);
    expect(children).toEqual(
      expect.arrayContaining([names.shank, names.headStage, names.rod])
    );
  });

  it("extrudes the shank standing tip-first at the probe's center tip", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).shank);
    expect(bounds.min).toEqual([-0.035, 0, -0.005]);
    expect(bounds.max).toEqual([0.035, 10.209, 0.005]);
  });

  it("places the head stage cone above the shank, as wide as the contour", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).headStage);
    expect(bounds.min).toEqual([-8, 10.209, -8]);
    expect(bounds.max).toEqual([8, 30.209, 8]);
  });

  it("places the rod above the head stage", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).rod);
    expect(bounds.min).toEqual([-8, 30.209, -8]);
    expect(bounds.max).toEqual([8, 230.209, 8]);
  });

  it("centers a multi-shank contour on the mean of its shanks and preserves its area", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe(
      {},
      { probe_planar_contour: NP2020_CONTOUR }
    );

    buildProbe(scene, probe, experiment);

    const names = probeMeshNames(probe.id);
    const bounds = roundedBounds(scene, names.shank);
    expect(bounds.min[0]).toBeCloseTo(-0.41, 6);
    expect(bounds.max[0]).toBeCloseTo(0.41, 6);
    expect(bounds.max[1]).toBeCloseTo(10.206, 6);
  });

  it("triangulates the shank's cap to match the contour's true area, including a multi-shank comb", () => {
    const scene = makeTestScene();
    const single = makeExperimentWithProbe();
    buildProbe(scene, single.probe, single.experiment);

    const singleArea = capTriangleArea(
      scene,
      probeMeshNames(single.probe.id).shank
    );
    expect(singleArea).toBeCloseTo(0.707315, 6);

    const multi = makeExperimentWithProbe(
      {},
      { probe_planar_contour: NP2020_CONTOUR }
    );
    buildProbe(scene, multi.probe, multi.experiment);
    const multiArea = capTriangleArea(
      scene,
      probeMeshNames(multi.probe.id).shank
    );
    expect(multiArea).toBeCloseTo(2.82884, 6);
  });

  it("shares one material between the shank and head stage, colored from the probe", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({ color: "#336699" });

    buildProbe(scene, probe, experiment);

    const names = probeMeshNames(probe.id);
    const shankMaterial = scene.getMeshByName(names.shank)!.material;
    const headStageMaterial = scene.getMeshByName(names.headStage)!.material;

    expect(shankMaterial).toBe(headStageMaterial);
    expect(shankMaterial!.name).toBe(`${probe.id}_material`);
    expect(
      (shankMaterial as StandardMaterial).diffuseColor.equals(
        Color3.FromHexString("#336699")
      )
    ).toBe(true);
  });

  it("gives the rod a separate, shared grey material", () => {
    const scene = makeTestScene();
    const a = makeExperimentWithProbe();
    const b = makeExperimentWithProbe();

    buildProbe(scene, a.probe, a.experiment);
    buildProbe(scene, b.probe, b.experiment);

    const rodMaterialA = scene.getMeshByName(
      probeMeshNames(a.probe.id).rod
    )!.material;
    const rodMaterialB = scene.getMeshByName(
      probeMeshNames(b.probe.id).rod
    )!.material;

    expect(rodMaterialA!.name).toBe("rod_material");
    expect(rodMaterialA).toBe(rodMaterialB);
    expect(
      scene.materials.filter(material => material.name === "rod_material")
    ).toHaveLength(1);
  });

  it("rebuilds idempotently, leaving one node, three meshes, and one material", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);
    buildProbe(scene, probe, experiment);

    expect(
      scene.transformNodes.filter(node => node.name === `${probe.id}_probe`)
    ).toHaveLength(1);
    expect(scene.meshes).toHaveLength(3);
    expect(
      scene.materials.filter(
        material => material.name === `${probe.id}_material`
      )
    ).toHaveLength(1);
  });

  it("reflects a changed probe color on rebuild", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({ color: "#ff0000" });

    buildProbe(scene, probe, experiment);
    probe.color = "#00ff00";
    buildProbe(scene, probe, experiment);

    const material = scene.getMeshByName(probeMeshNames(probe.id).shank)!
      .material as StandardMaterial;
    expect(material.diffuseColor.equals(Color3.FromHexString("#00ff00"))).toBe(
      true
    );
  });

  it("does not dispose the shared rod material when another probe is rebuilt", () => {
    const scene = makeTestScene();
    const a = makeExperimentWithProbe();
    const b = makeExperimentWithProbe();

    buildProbe(scene, a.probe, a.experiment);
    buildProbe(scene, b.probe, b.experiment);
    buildProbe(scene, a.probe, a.experiment);

    const rodMaterialB = scene.getMeshByName(
      probeMeshNames(b.probe.id).rod
    )!.material!;
    expect(scene.materials).toContain(rodMaterialB);
    expect(
      scene.materials.filter(material => material.name === "rod_material")
    ).toHaveLength(1);
  });

  it("returns null and adds nothing when the probe interface definition is not interned", () => {
    const scene = makeTestScene();
    const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
    const probe = makeProbe({
      probeInterfaceIdentifier: "missing manufacturer"
    });

    const node = buildProbe(scene, probe, experiment);

    expect(node).toBeNull();
    expect(scene.meshes).toHaveLength(0);
    expect(scene.materials).toHaveLength(0);
    expect(scene.transformNodes).toHaveLength(0);
  });

  it("returns null and adds nothing when the probe interface definition has no contour", () => {
    const scene = makeTestScene();
    const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
    const probeInterfaceProbe = makeProbeInterfaceProbe();
    internProbeInterfaceProbe(experiment, probeInterfaceProbe);
    const probe = makeProbe({
      probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe)
    });
    addProbe(experiment, probe);

    const node = buildProbe(scene, probe, experiment);

    expect(node).toBeNull();
    expect(scene.meshes).toHaveLength(0);
  });

  it("returns null when the contour has fewer than 3 points", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe(
      {},
      {
        probe_planar_contour: [
          [0, 0],
          [1, 1]
        ]
      }
    );

    const node = buildProbe(scene, probe, experiment);

    expect(node).toBeNull();
  });

  it("scales millimeter contours 1000x smaller than the equivalent micrometer contour", () => {
    const scene = makeTestScene();
    const micrometers = makeExperimentWithProbe();
    buildProbe(scene, micrometers.probe, micrometers.experiment);
    const micrometerBounds = roundedBounds(
      scene,
      probeMeshNames(micrometers.probe.id).shank
    );

    const millimeters = makeExperimentWithProbe({}, { si_units: "mm" });
    buildProbe(scene, millimeters.probe, millimeters.experiment);
    const millimeterBounds = roundedBounds(
      scene,
      probeMeshNames(millimeters.probe.id).shank
    );

    expect(millimeterBounds.max[0]).toBeCloseTo(
      micrometerBounds.max[0]! * 1000,
      6
    );
    expect(millimeterBounds.max[1]).toBeCloseTo(
      micrometerBounds.max[1]! * 1000,
      6
    );
  });

  it("falls back to micrometers for an unrecognized si_units value", () => {
    const scene = makeTestScene();
    const known = makeExperimentWithProbe();
    buildProbe(scene, known.probe, known.experiment);
    const knownBounds = roundedBounds(
      scene,
      probeMeshNames(known.probe.id).shank
    );

    const unknown = makeExperimentWithProbe({}, { si_units: "nonsense" });
    buildProbe(scene, unknown.probe, unknown.experiment);
    const unknownBounds = roundedBounds(
      scene,
      probeMeshNames(unknown.probe.id).shank
    );

    expect(unknownBounds).toEqual(knownBounds);
  });
});
