import { describe, expect, it, vi } from "vitest";
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
import { buildProbe, disposeProbe, syncProbes } from "./probe.api";

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

/** Shank, head stage, rod, and contacts mesh names for a probe. */
function probeMeshNames(probeId: string) {
  return {
    shank: `${probeId}_shank_mesh`,
    headStage: `${probeId}_headStage_mesh`,
    rod: `${probeId}_rod_mesh`,
    contacts: `${probeId}_contacts_mesh`
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
  it("builds a transform node with the shank, head stage, rod, and contacts meshes parented under it", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    const node = buildProbe(scene, probe, experiment);

    expect(node).not.toBeNull();
    expect(node!.name).toBe(`${probe.id}_probe`);

    const names = probeMeshNames(probe.id);
    const children = node!.getChildMeshes().map(mesh => mesh.name);
    expect(children).toHaveLength(4);
    expect(children).toEqual(
      expect.arrayContaining([
        names.shank,
        names.headStage,
        names.rod,
        names.contacts
      ])
    );
  });

  it("parents the probe node to the reference coordinate node under the atlas root", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    const node = buildProbe(scene, probe, experiment);

    expect(node!.parent!.name).toBe("referenceCoordinate_node");
    expect(node!.parent!.parent!.name).toBe("atlasRoot_node");
  });

  it("extrudes the shank standing tip-first at the probe's center tip", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).shank);
    expect(bounds.min).toEqual([-0.035, -10.209, -0.005]);
    expect(bounds.max).toEqual([0.035, 0, 0.005]);
  });

  it("places the head stage cone above the shank, as wide as the contour", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).headStage);
    expect(bounds.min).toEqual([-8, -30.209, -8]);
    expect(bounds.max).toEqual([8, -10.209, 8]);
  });

  it("places the rod above the head stage", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).rod);
    expect(bounds.min).toEqual([-8, -230.209, -8]);
    expect(bounds.max).toEqual([8, -30.209, 8]);
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
    expect(bounds.min[1]).toBeCloseTo(-10.206, 6);
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

  it("returns the existing entity on a second call, leaving one node, four meshes, and one material", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);
    buildProbe(scene, probe, experiment);

    expect(
      scene.transformNodes.filter(node => node.name === `${probe.id}_probe`)
    ).toHaveLength(1);
    expect(scene.meshes).toHaveLength(4);
    expect(
      scene.materials.filter(
        material => material.name === `${probe.id}_material`
      )
    ).toHaveLength(1);
  });

  it("returns the same node and meshes on a second call, ignoring a color changed in between", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({ color: "#ff0000" });

    const node = buildProbe(scene, probe, experiment);
    const shankMesh = scene.getMeshByName(probeMeshNames(probe.id).shank);

    probe.color = "#00ff00";
    const rebuiltNode = buildProbe(scene, probe, experiment);

    expect(rebuiltNode).toBe(node);
    expect(scene.getMeshByName(probeMeshNames(probe.id).shank)).toBe(shankMesh);
    const material = shankMesh!.material as StandardMaterial;
    expect(material.diffuseColor.equals(Color3.FromHexString("#ff0000"))).toBe(
      true
    );
  });

  it("reflects a changed probe color after an explicit dispose and rebuild", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({ color: "#ff0000" });

    buildProbe(scene, probe, experiment);
    probe.color = "#00ff00";
    disposeProbe(scene, probe);
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
    disposeProbe(scene, a.probe);
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

describe("buildProbe contacts mesh", () => {
  it("covers the bounding box of square contacts, including their width", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe(
      {},
      {
        probe_planar_contour: NP2020_CONTOUR,
        contact_positions: [
          [0, 0],
          [782, 9585]
        ],
        contact_shapes: ["square", "square"],
        contact_shape_params: [{ width: 12 }, { width: 12 }]
      }
    );

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).contacts);
    expect(bounds.min).toEqual([-0.389, -9.808, -0.006]);
    expect(bounds.max).toEqual([0.405, -0.211, -0.006]);
  });

  it("covers the same box for circle contacts using radius", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe(
      {},
      {
        probe_planar_contour: NP2020_CONTOUR,
        contact_positions: [
          [0, 0],
          [782, 9585]
        ],
        contact_shapes: ["circle", "circle"],
        contact_shape_params: [{ radius: 6 }, { radius: 6 }]
      }
    );

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).contacts);
    expect(bounds.min).toEqual([-0.389, -9.808, -0.006]);
    expect(bounds.max).toEqual([0.405, -0.211, -0.006]);
  });

  it("uses width and height independently for rect contacts", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe(
      {},
      {
        probe_planar_contour: NP2020_CONTOUR,
        contact_positions: [
          [0, 0],
          [782, 9585]
        ],
        contact_shapes: ["rect", "rect"],
        contact_shape_params: [
          { width: 12, height: 8 },
          { width: 12, height: 8 }
        ]
      }
    );

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).contacts);
    expect(bounds.min).toEqual([-0.389, -9.806, -0.006]);
    expect(bounds.max).toEqual([0.405, -0.213, -0.006]);
  });

  it("falls back to the raw contact positions when shapes are not usable", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe(
      {},
      {
        probe_planar_contour: NP2020_CONTOUR,
        contact_positions: [
          [0, 0],
          [782, 9585]
        ]
      }
    );

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).contacts);
    expect(bounds.min).toEqual([-0.383, -9.802, -0.006]);
    expect(bounds.max).toEqual([0.399, -0.217, -0.006]);
  });

  it("falls back to the contour's own box when there are no usable contacts", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe(
      {},
      {
        probe_planar_contour: NP2020_CONTOUR,
        contact_positions: []
      }
    );

    buildProbe(scene, probe, experiment);

    const bounds = roundedBounds(scene, probeMeshNames(probe.id).contacts);
    expect(bounds.min).toEqual([-0.41, -10.206, -0.006]);
    expect(bounds.max).toEqual([0.41, 0, -0.006]);
  });

  it("falls back to the contour's own box for a single, extent-less contact", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const shankBounds = roundedBounds(scene, probeMeshNames(probe.id).shank);
    const contactsBounds = roundedBounds(
      scene,
      probeMeshNames(probe.id).contacts
    );
    expect(contactsBounds.min[0]).toBeCloseTo(shankBounds.min[0]!, 6);
    expect(contactsBounds.max[0]).toBeCloseTo(shankBounds.max[0]!, 6);
    expect(contactsBounds.max[1]).toBeCloseTo(0, 6);
  });

  it("is a single-sided quad facing the shank's front (local +z)", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);

    const mesh = scene.getMeshByName(probeMeshNames(probe.id).contacts)!;
    expect(mesh.getVerticesData("position")).toHaveLength(12);
    const normals = mesh.getVerticesData("normal")!;
    for (let i = 0; i < normals.length; i += 3) {
      expect(normals[i]).toBeCloseTo(0, 6);
      expect(normals[i + 1]).toBeCloseTo(0, 6);
      expect(normals[i + 2]).toBeCloseTo(1, 6);
    }
    expect((mesh.material as StandardMaterial).backFaceCulling).toBe(true);
  });

  it("colors the contacts material from the probe at 10% of its saturation", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({
      color: "#336699"
    });

    buildProbe(scene, probe, experiment);

    const shankMaterial = scene.getMeshByName(probeMeshNames(probe.id).shank)!
      .material as StandardMaterial;
    const contactsMaterial = scene.getMeshByName(
      probeMeshNames(probe.id).contacts
    )!.material as StandardMaterial;

    expect(contactsMaterial).not.toBe(shankMaterial);
    expect(contactsMaterial.name).toBe(`${probe.id}_contacts_material`);

    const [hue, saturation, value] = Color3.FromHexString("#336699")
      .toHSV()
      .asArray();
    const expectedColor = Color3.FromHSV(hue, saturation * 0.1, value);
    expect(contactsMaterial.diffuseColor.equals(expectedColor)).toBe(true);
  });

  it("does not tint an already-neutral probe's contacts material", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({
      color: "#ffffff"
    });

    buildProbe(scene, probe, experiment);

    const contactsMaterial = scene.getMeshByName(
      probeMeshNames(probe.id).contacts
    )!.material as StandardMaterial;
    expect(contactsMaterial.diffuseColor.equals(Color3.White())).toBe(true);
  });

  it("disposes the contacts material along with the probe", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    buildProbe(scene, probe, experiment);
    disposeProbe(scene, probe);

    expect(
      scene.materials.filter(
        material => material.name === `${probe.id}_contacts_material`
      )
    ).toHaveLength(0);
  });

  it("does not dispose another probe's contacts material", () => {
    const scene = makeTestScene();
    const a = makeExperimentWithProbe();
    const b = makeExperimentWithProbe();

    buildProbe(scene, a.probe, a.experiment);
    buildProbe(scene, b.probe, b.experiment);
    disposeProbe(scene, a.probe);

    const contactsMaterialB = scene.getMeshByName(
      probeMeshNames(b.probe.id).contacts
    )!.material!;
    expect(scene.materials).toContain(contactsMaterialB);
  });
});

describe("syncProbes", () => {
  it("freezes a probe's material and the shared rod material", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();

    syncProbes(scene, experiment);

    expect(scene.getMaterialByName(`${probe.id}_material`)!.isFrozen).toBe(
      true
    );
    expect(scene.getMaterialByName("rod_material")!.isFrozen).toBe(true);
  });

  it("applies a changed probe color to its frozen material", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({
      color: "#ff0000"
    });
    syncProbes(scene, experiment);

    probe.color = "#00ff00";
    syncProbes(scene, experiment);

    const material = scene.getMaterialByName(
      `${probe.id}_material`
    ) as StandardMaterial;
    expect(material.diffuseColor.equals(Color3.FromHexString("#00ff00"))).toBe(
      true
    );
    expect(material.isFrozen).toBe(true);
  });

  it("forces a probe's frozen material to rebind when its color changes", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe({
      color: "#ff0000"
    });
    syncProbes(scene, experiment);

    const material = scene.getMaterialByName(`${probe.id}_material`)!;
    const markDirtySpy = vi.spyOn(material, "markDirty");

    probe.color = "#00ff00";
    syncProbes(scene, experiment);

    expect(markDirtySpy).toHaveBeenCalledWith(true);
  });

  it("leaves a frozen probe material untouched when nothing changed", () => {
    const scene = makeTestScene();
    const { experiment, probe } = makeExperimentWithProbe();
    syncProbes(scene, experiment);

    const material = scene.getMaterialByName(`${probe.id}_material`)!;
    const markDirtySpy = vi.spyOn(material, "markDirty");

    syncProbes(scene, experiment);

    expect(markDirtySpy).not.toHaveBeenCalled();
  });

  it("keeps the shared rod material frozen without re-freezing it when another probe is added", () => {
    const scene = makeTestScene();
    const { experiment } = makeExperimentWithProbe();
    syncProbes(scene, experiment);

    const rodMaterial = scene.getMaterialByName("rod_material")!;
    const markDirtySpy = vi.spyOn(rodMaterial, "markDirty");

    const other = makeProbe({
      probeInterfaceIdentifier: experiment.probes[0]!.probeInterfaceIdentifier
    });
    addProbe(experiment, other);
    syncProbes(scene, experiment);

    expect(rodMaterial.isFrozen).toBe(true);
    expect(markDirtySpy).not.toHaveBeenCalled();
  });
});
