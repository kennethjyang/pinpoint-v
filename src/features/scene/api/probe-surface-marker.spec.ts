import { describe, expect, it } from "vitest";
import { Color3, StandardMaterial } from "@babylonjs/core";
import { makeProbe } from "@/test/fixtures";
import { makeTestScene } from "@/test/mount-helper";
import { asrToVector3 } from "./coordinate-transforms.api";
import { syncProbeSurfaceMarker } from "./probe-surface-marker.api";

describe("syncProbeSurfaceMarker", () => {
  it("builds a 1mm sphere parented to the atlas root, unpickable, positioned, and colored with the probe's color", () => {
    const scene = makeTestScene();
    const probe = makeProbe({ color: "#00ff00" });
    const marker = {
      probeId: probe.id,
      position: [5, 3, 5] as [number, number, number]
    };

    syncProbeSurfaceMarker(scene, marker, [probe]);

    const mesh = scene.getMeshByName("probeSurfaceMarker_mesh")!;
    expect(mesh).toBeTruthy();
    expect(mesh.parent?.name).toBe("atlasRoot_node");
    expect(mesh.isPickable).toBe(false);
    expect(mesh.position.asArray()).toEqual(
      asrToVector3(marker.position).asArray()
    );
    const extendSize = mesh.getBoundingInfo().boundingBox.extendSize;
    expect(extendSize.x).toBeCloseTo(0.5);
    expect(extendSize.y).toBeCloseTo(0.5);
    expect(extendSize.z).toBeCloseTo(0.5);

    const material = scene.getMaterialByName("probeSurfaceMarker_material");
    expect(material).toBeInstanceOf(StandardMaterial);
    expect(
      (material as StandardMaterial).emissiveColor.equals(
        Color3.FromHexString("#00ff00")
      )
    ).toBe(true);
  });

  it("moves the same mesh on a second call instead of rebuilding it", () => {
    const scene = makeTestScene();
    const probe = makeProbe();

    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [1, 2, 3] }, [
      probe
    ]);
    const firstMesh = scene.getMeshByName("probeSurfaceMarker_mesh")!;

    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [4, 5, 6] }, [
      probe
    ]);
    const secondMesh = scene.getMeshByName("probeSurfaceMarker_mesh")!;

    expect(secondMesh.uniqueId).toBe(firstMesh.uniqueId);
    expect(secondMesh.position.asArray()).toEqual(
      asrToVector3([4, 5, 6]).asArray()
    );
  });

  it("recolors the existing material when the probe's color changes", () => {
    const scene = makeTestScene();
    const probe = makeProbe({ color: "#ff0000" });
    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [1, 2, 3] }, [
      probe
    ]);

    probe.color = "#0000ff";
    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [1, 2, 3] }, [
      probe
    ]);

    const material = scene.getMaterialByName(
      "probeSurfaceMarker_material"
    ) as StandardMaterial;
    expect(material.emissiveColor.equals(Color3.FromHexString("#0000ff"))).toBe(
      true
    );
  });

  it("disposes the mesh and material when the marker is null", () => {
    const scene = makeTestScene();
    const probe = makeProbe();
    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [1, 2, 3] }, [
      probe
    ]);

    syncProbeSurfaceMarker(scene, null, [probe]);

    expect(scene.getMeshByName("probeSurfaceMarker_mesh")).toBeNull();
    expect(scene.getMaterialByName("probeSurfaceMarker_material")).toBeNull();
  });

  it("disposes the mesh and material when the marker's probe is absent from probes", () => {
    const scene = makeTestScene();
    const probe = makeProbe();
    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [1, 2, 3] }, [
      probe
    ]);

    syncProbeSurfaceMarker(
      scene,
      { probeId: "missing-probe", position: [1, 2, 3] },
      [probe]
    );

    expect(scene.getMeshByName("probeSurfaceMarker_mesh")).toBeNull();
    expect(scene.getMaterialByName("probeSurfaceMarker_material")).toBeNull();
  });

  it("disposes the mesh and material when the probe's visibility is hidden", () => {
    const scene = makeTestScene();
    const probe = makeProbe();
    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [1, 2, 3] }, [
      probe
    ]);

    probe.visibility = "hidden";
    syncProbeSurfaceMarker(scene, { probeId: probe.id, position: [1, 2, 3] }, [
      probe
    ]);

    expect(scene.getMeshByName("probeSurfaceMarker_mesh")).toBeNull();
    expect(scene.getMaterialByName("probeSurfaceMarker_material")).toBeNull();
  });
});
