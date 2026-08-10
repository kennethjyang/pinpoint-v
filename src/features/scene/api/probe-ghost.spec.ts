import { beforeAll, describe, expect, it } from "vitest";
import { Mesh } from "@babylonjs/core";
import type { Experiment } from "@/features/experiment";
import {
  addProbe,
  buildExperiment,
  internProbeInterfaceProbe
} from "@/features/experiment";
import type { Probe, ProbeGhost } from "@/features/probe";
import { getProbeInterfaceIdentifier } from "@/features/probe";
import {
  makeAtlas,
  makeProbe,
  makeProbeGeometry,
  makeProbeInterfaceProbe
} from "@/test/fixtures";
import {
  initializeTestCSG2,
  makeTestSceneWithGizmo
} from "@/test/mount-helper";
import { buildProbe, getProbeShankMesh } from "./probe.api";
import { asrToVector3 } from "./coordinate-transforms.api";
import { disposeProbeGhost, syncProbeGhost } from "./probe-ghost.api";

/** Single-shank contour, in micrometers - mirrors probe.spec.ts's NP1000. */
const NP1000_CONTOUR = [
  [-11, 9989],
  [-11, -11],
  [24, -220],
  [59, -11],
  [59, 9989]
];

/**
 * Build an experiment with a single interned probe interface definition and
 * a probe referencing it.
 */
function makeExperimentWithProbe(probeOverrides: Partial<Probe> = {}): {
  experiment: Experiment;
  probe: Probe;
} {
  const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
  const probeInterfaceProbe = makeProbeInterfaceProbe({
    probe_planar_contour: NP1000_CONTOUR
  });
  internProbeInterfaceProbe(experiment, probeInterfaceProbe);

  const probe = makeProbe({
    probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe),
    ...probeOverrides
  });
  addProbe(experiment, probe);

  return { experiment, probe };
}

/** Build a fixture ghost pointed at a probe. */
function makeGhost(overrides: Partial<ProbeGhost> = {}): ProbeGhost {
  return {
    probeId: "probe-1",
    tipPosition: [5, 3, 5],
    rotation: [0.1, 0.2, 0.3],
    ...overrides
  };
}

// The head stage is CSG2-subtracted; initialize it once for every test in
// this file, mirroring what probe.spec.ts does.
beforeAll(async () => {
  await initializeTestCSG2();
});

describe("syncProbeGhost", () => {
  it("creates the ghost node under the probe's parent, posed and with unpickable meshes sharing one material", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const { experiment, probe } = makeExperimentWithProbe();
    const probeNode = buildProbe(
      scene,
      probe,
      experiment,
      gizmoManager,
      makeProbeGeometry()
    )!;
    const ghost = makeGhost({ probeId: probe.id });

    syncProbeGhost(scene, ghost, []);

    const ghostNode = scene.getTransformNodeByName("probeGhost_node")!;
    expect(ghostNode).toBeTruthy();
    expect(ghostNode.parent).toBe(probeNode.parent);
    expect(ghostNode.position.asArray()).toEqual(
      asrToVector3(ghost.tipPosition).asArray()
    );
    expect(ghostNode.rotation.asArray()).toEqual(
      asrToVector3(ghost.rotation).asArray()
    );

    const childMeshes = ghostNode.getChildMeshes();
    expect(childMeshes.length).toBeGreaterThan(0);
    const material = scene.getMaterialByName("probeGhost_material")!;
    for (const mesh of childMeshes) {
      expect(mesh.isPickable).toBe(false);
      expect(mesh.material).toBe(material);
    }
  });

  it("does not shadow the real probe's shank mesh lookup", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const { experiment, probe } = makeExperimentWithProbe();
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());

    syncProbeGhost(scene, makeGhost({ probeId: probe.id }), []);

    const shankMesh = getProbeShankMesh(scene, probe.id);
    expect(shankMesh).toBeTruthy();
    expect(shankMesh).toBeInstanceOf(Mesh);
  });

  it("moves the same node on a second call with the same probe id, and replaces it when rebuilt", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const { experiment, probe } = makeExperimentWithProbe();
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());

    syncProbeGhost(scene, makeGhost({ probeId: probe.id }), []);
    const firstNode = scene.getTransformNodeByName("probeGhost_node")!;

    syncProbeGhost(
      scene,
      makeGhost({ probeId: probe.id, tipPosition: [1, 2, 3] }),
      []
    );
    const secondNode = scene.getTransformNodeByName("probeGhost_node")!;

    expect(secondNode.uniqueId).toBe(firstNode.uniqueId);
    expect(secondNode.position.asArray()).toEqual(
      asrToVector3([1, 2, 3]).asArray()
    );

    syncProbeGhost(
      scene,
      makeGhost({ probeId: probe.id, tipPosition: [4, 5, 6] }),
      [probe.id]
    );
    const thirdNode = scene.getTransformNodeByName("probeGhost_node")!;

    expect(thirdNode.uniqueId).not.toBe(secondNode.uniqueId);
  });

  it("removes any existing ghost and builds nothing when null", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const { experiment, probe } = makeExperimentWithProbe();
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    syncProbeGhost(scene, makeGhost({ probeId: probe.id }), []);

    syncProbeGhost(scene, null, []);

    expect(scene.getTransformNodeByName("probeGhost_node")).toBeNull();
    expect(scene.getMaterialByName("probeGhost_material")).toBeNull();
  });

  it("removes any existing ghost and builds nothing when the probe has no transform node", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const { experiment, probe } = makeExperimentWithProbe();
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    syncProbeGhost(scene, makeGhost({ probeId: probe.id }), []);

    syncProbeGhost(scene, makeGhost({ probeId: "missing-probe" }), []);

    expect(scene.getTransformNodeByName("probeGhost_node")).toBeNull();
    expect(scene.getMaterialByName("probeGhost_material")).toBeNull();
  });
});

describe("disposeProbeGhost", () => {
  it("disposes the ghost node, its meshes, and its material", () => {
    const { scene, gizmoManager } = makeTestSceneWithGizmo();
    const { experiment, probe } = makeExperimentWithProbe();
    buildProbe(scene, probe, experiment, gizmoManager, makeProbeGeometry());
    syncProbeGhost(scene, makeGhost({ probeId: probe.id }), []);

    disposeProbeGhost(scene);

    expect(scene.getTransformNodeByName("probeGhost_node")).toBeNull();
    expect(scene.getMaterialByName("probeGhost_material")).toBeNull();
    expect(
      scene.meshes.some(mesh => mesh.name.startsWith("probeGhost_node"))
    ).toBe(false);
  });

  it("does nothing when no ghost exists", () => {
    const { scene } = makeTestSceneWithGizmo();

    expect(() => disposeProbeGhost(scene)).not.toThrow();
  });
});
