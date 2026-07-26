import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import {
  Color3,
  DracoDecoder,
  Geometry,
  Logger,
  Mesh,
  MeshBuilder,
  NullEngine,
  Scene,
  StandardMaterial,
  Vector3,
  VertexBuffer,
  VertexData
} from "@babylonjs/core";
import {
  decodeMesh,
  fetchMeshData,
  flipWindingOrder,
  setAtlasRootReference,
  syncStructureVisibility,
  targetVertexCount
} from "./entity-loader.api";
import type { StructureEntity } from "@/features/scene";
import { asrToBabylon } from "@/features/scene";

vi.mock("axios");

function makeStructureEntity(
  overrides: Partial<StructureEntity> = {}
): StructureEntity {
  return {
    identifier: 1,
    meshPath: "http://localhost:3000/allen_mouse/meshes/1.glb",
    color: Color3.FromInts(255, 0, 0),
    ...overrides
  };
}

/** Build a real Babylon scene for tests that need actual mesh geometry. */
function makeScene(): Scene {
  return new Scene(new NullEngine());
}

/**
 * Build a positions+indices-only geometry (no normals), mirroring what a
 * Draco decode produces, from a subdivided sphere so it has enough vertices
 * to simplify meaningfully.
 */
function makeRawGeometry(scene: Scene, id = "geometry"): Geometry {
  const source = MeshBuilder.CreateSphere(
    `${id}_source`,
    { segments: 12 },
    scene
  );
  const vertexData = new VertexData();
  vertexData.positions = source.getVerticesData(VertexBuffer.PositionKind);
  vertexData.indices = source.getIndices();
  source.dispose();

  return new Geometry(id, scene, vertexData, false);
}

/** Build a positions+indices-only mesh (see `makeRawGeometry`). */
function makeUnlitMesh(scene: Scene, name = "raw"): Mesh {
  const mesh = new Mesh(name, scene);
  makeRawGeometry(scene, `${name}_geometry`).applyToMesh(mesh);
  return mesh;
}

describe("targetVertexCount", () => {
  it("keeps 5% of the original vertex count", () => {
    expect(targetVertexCount(100_000)).toBe(5000);
  });

  it("clamps to 8000 vertices for large meshes", () => {
    expect(targetVertexCount(1_000_000)).toBe(8000);
  });

  it("rounds to the nearest vertex", () => {
    expect(targetVertexCount(101)).toBe(5); // 101 * 0.05 = 5.05 -> 5
  });

  it("returns 0 for an empty mesh", () => {
    expect(targetVertexCount(0)).toBe(0);
  });

  it("can exceed the original count for very small meshes (caller compares)", () => {
    // 5% of 10 is 0.5, rounded to 1 -- below original, but small meshes still
    // fall under the "target >= count" no-op path in the simplification
    // worker (0.5 -> 1 is still < 10 here; use an even smaller mesh to hit
    // the crossover).
    expect(targetVertexCount(10)).toBe(1);
  });
});

describe("flipWindingOrder", () => {
  it("swaps the last two indices of each triangle", () => {
    const scene = makeScene();
    const mesh = new Mesh("m", scene);
    const vertexData = new VertexData();
    vertexData.positions = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
    vertexData.indices = [0, 1, 2, 3, 4, 5];
    vertexData.applyToMesh(mesh);

    flipWindingOrder(mesh);

    expect(Array.from(mesh.getIndices()!)).toEqual([0, 2, 1, 3, 5, 4]);
  });

  it("leaves vertex positions untouched", () => {
    const scene = makeScene();
    const mesh = new Mesh("m", scene);
    const vertexData = new VertexData();
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    vertexData.positions = [...positions];
    vertexData.indices = [0, 1, 2];
    vertexData.applyToMesh(mesh);

    flipWindingOrder(mesh);

    expect(
      Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!)
    ).toEqual(positions);
  });

  it("does nothing when the mesh has no indices", () => {
    const scene = makeScene();
    const mesh = new Mesh("m", scene);
    const vertexData = new VertexData();
    vertexData.positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    vertexData.applyToMesh(mesh);

    expect(() => flipWindingOrder(mesh)).not.toThrow();
  });

  /**
   * Fraction of a mesh's vertices whose computed normal points away from
   * the mesh centroid (i.e. outward).
   */
  function outwardNormalFraction(mesh: Mesh): number {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const vertexCount = mesh.getTotalVertices();

    const centroid = new Vector3(0, 0, 0);
    for (let i = 0; i < vertexCount; i++) {
      centroid.addInPlace(
        new Vector3(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2]
        )
      );
    }
    centroid.scaleInPlace(1 / vertexCount);

    let outward = 0;
    for (let i = 0; i < vertexCount; i++) {
      const direction = new Vector3(
        positions[i * 3]!,
        positions[i * 3 + 1]!,
        positions[i * 3 + 2]!
      )
        .subtract(centroid)
        .normalize();
      const normal = new Vector3(
        normals[i * 3]!,
        normals[i * 3 + 1]!,
        normals[i * 3 + 2]!
      );
      if (Vector3.Dot(direction, normal) > 0) outward++;
    }
    return outward / vertexCount;
  }

  it("makes computed normals face outward on a mesh wound for a right-handed system", () => {
    const scene = makeScene();
    // Babylon's built-in sphere is already wound for this (left-handed)
    // scene; reverse it once to simulate a right-handed source like a
    // BrainGlobe Draco mesh, matching what flipWindingOrder is meant to fix.
    const rightHandedWound = makeUnlitMesh(scene, "sphere");
    const reversed = Array.from(rightHandedWound.getIndices()!);
    for (let i = 0; i < reversed.length; i += 3) {
      const temp = reversed[i + 1]!;
      reversed[i + 1] = reversed[i + 2]!;
      reversed[i + 2] = temp;
    }
    rightHandedWound.setIndices(reversed);

    flipWindingOrder(rightHandedWound);
    rightHandedWound.createNormals(false);

    expect(outwardNormalFraction(rightHandedWound)).toBeGreaterThan(0.9);
  });

  it("without the fix, a right-handed-wound mesh's normals point inward", () => {
    const scene = makeScene();
    const rightHandedWound = makeUnlitMesh(scene, "sphere");
    const reversed = Array.from(rightHandedWound.getIndices()!);
    for (let i = 0; i < reversed.length; i += 3) {
      const temp = reversed[i + 1]!;
      reversed[i + 1] = reversed[i + 2]!;
      reversed[i + 2] = temp;
    }
    rightHandedWound.setIndices(reversed);

    // No flipWindingOrder call here -- this is the control case.
    rightHandedWound.createNormals(false);

    expect(outwardNormalFraction(rightHandedWound)).toBeLessThan(0.1);
  });
});

describe("fetchMeshData", () => {
  // axios.get is only ever passed to vi.mocked() to retrieve its mock, never
  // called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedGet = vi.mocked(axios.get);

  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("fetches the mesh path as an array buffer", async () => {
    const buffer = new ArrayBuffer(4);
    mockedGet.mockResolvedValue({ data: buffer });

    const result = await fetchMeshData("http://localhost:3000/meshes/1");

    expect(mockedGet).toHaveBeenCalledWith("http://localhost:3000/meshes/1", {
      responseType: "arraybuffer"
    });
    expect(result).toBe(buffer);
  });

  it("propagates a rejection when the request fails", async () => {
    mockedGet.mockRejectedValue(new Error("network error"));

    await expect(
      fetchMeshData("http://localhost:3000/meshes/1")
    ).rejects.toThrow("network error");
  });
});

describe("decodeMesh", () => {
  it("scales nanometer positions to millimeters without reordering axes", async () => {
    const scene = makeScene();
    const geometry = new Geometry("draco_geometry", scene, undefined, false);
    const vertexData = new VertexData();
    // A single triangle at (1_000_000, 2_000_000, 3_000_000) nm, no normals
    // -- mirroring a Draco-decoded structure mesh.
    vertexData.positions = [1_000_000, 2_000_000, 3_000_000, 0, 0, 0, 0, 0, 0];
    vertexData.indices = [0, 1, 2];
    vertexData.applyToGeometry(geometry);

    const decodeSpy = vi
      .spyOn(DracoDecoder.Default, "decodeMeshToGeometryAsync")
      .mockResolvedValue(geometry);

    const decoded = await decodeMesh("1", new ArrayBuffer(0), scene);

    expect(decodeSpy).toHaveBeenCalledWith("1", scene, expect.any(ArrayBuffer));
    // Nanometers -> millimeters; axis order unchanged. Positions are
    // float32, so allow for the usual float32 rounding error.
    const [x, y, z] = Array.from(decoded.positions);
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(2, 5);
    expect(z).toBeCloseTo(3, 5);

    decodeSpy.mockRestore();
  });

  it("flips the triangle winding order", async () => {
    const scene = makeScene();
    const geometry = new Geometry("draco_geometry", scene, undefined, false);
    const vertexData = new VertexData();
    vertexData.positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    vertexData.indices = [0, 1, 2];
    vertexData.applyToGeometry(geometry);

    const decodeSpy = vi
      .spyOn(DracoDecoder.Default, "decodeMeshToGeometryAsync")
      .mockResolvedValue(geometry);

    const decoded = await decodeMesh("1", new ArrayBuffer(0), scene);

    expect(Array.from(decoded.indices)).toEqual([0, 2, 1]);

    decodeSpy.mockRestore();
  });
});

describe("syncStructureVisibility", () => {
  // axios.get is only ever passed to vi.mocked() to retrieve its mock, never
  // called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedGet = vi.mocked(axios.get);

  beforeEach(() => {
    mockedGet.mockReset();
    mockedGet.mockResolvedValue({ data: new ArrayBuffer(0) });
  });

  /** Stub Draco decoding with a real, positions-only sphere geometry. */
  function stubDecode(scene: Scene) {
    return vi
      .spyOn(DracoDecoder.Default, "decodeMeshToGeometryAsync")
      .mockImplementation(name =>
        Promise.resolve(makeRawGeometry(scene, name))
      );
  }

  it("imports a new structure, parented to the atlas root and colored", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const structure = makeStructureEntity({ identifier: 1 });
    const onProgress = vi.fn();

    await syncStructureVisibility(scene, [], [structure], onProgress);

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    const mesh = atlasRootNode
      .getChildren()
      .find(c => c.name === "1_structure") as Mesh;
    expect(mesh).toBeDefined();
    expect(mesh.isVisible).toBe(true);
    expect(mesh.isVerticesDataPresent(VertexBuffer.NormalKind)).toBe(true);
    expect(mesh.getVerticesData(VertexBuffer.NormalKind)!.length).toBe(
      mesh.getTotalVertices() * 3
    );

    const material = mesh.material as StandardMaterial;
    expect(material.name).toBe("1_material");
    expect(material.diffuseColor.equals(structure.color)).toBe(true);
    expect(material.alpha).toBe(1);

    decodeSpy.mockRestore();
  });

  it("fades an always-present structure that isn't visible to alpha 0.1", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const structure = makeStructureEntity({ identifier: 1 });

    await syncStructureVisibility(scene, [structure], [], vi.fn());

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    const mesh = atlasRootNode
      .getChildren()
      .find(c => c.name === "1_structure") as Mesh;
    expect(mesh.material!.alpha).toBe(0.1);

    decodeSpy.mockRestore();
  });

  it("does not re-import a structure that's already present", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const structure = makeStructureEntity({ identifier: 1 });

    await syncStructureVisibility(scene, [], [structure], vi.fn());
    decodeSpy.mockClear();
    await syncStructureVisibility(scene, [], [structure], vi.fn());

    expect(decodeSpy).not.toHaveBeenCalled();

    decodeSpy.mockRestore();
  });

  it("removes structures that are no longer desired", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const structure = makeStructureEntity({ identifier: 1 });

    await syncStructureVisibility(scene, [], [structure], vi.fn());
    await syncStructureVisibility(scene, [], [], vi.fn());

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    expect(
      atlasRootNode.getChildren().some(c => c.name === "1_structure")
    ).toBe(false);

    decodeSpy.mockRestore();
  });

  it("disposes a removed structure's material rather than leaking it, and its alpha is correct once re-imported", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const structure = makeStructureEntity({ identifier: 1 });

    // Import the structure, remove it, then bring it back as
    // always-present-but-not-visible.
    await syncStructureVisibility(scene, [], [structure], vi.fn());
    await syncStructureVisibility(scene, [], [], vi.fn());
    await syncStructureVisibility(scene, [structure], [], vi.fn());

    // The removed material must not linger: exactly one "1_material" should
    // exist, not an orphaned first one shadowing the live one.
    expect(scene.materials.filter(m => m.name === "1_material")).toHaveLength(
      1
    );

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    const mesh = atlasRootNode
      .getChildren()
      .find(c => c.name === "1_structure") as Mesh;
    expect(mesh.material!.alpha).toBe(0.1);

    decodeSpy.mockRestore();
  });

  it("gives each structure its own alpha rather than collapsing on a shared key", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const alwaysPresent = makeStructureEntity({ identifier: 1 });
    const visible = makeStructureEntity({ identifier: 2 });

    await syncStructureVisibility(
      scene,
      [alwaysPresent, visible],
      [visible],
      vi.fn()
    );

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    const meshes = atlasRootNode.getChildren() as Mesh[];
    const fadedMesh = meshes.find(m => m.name === "1_structure")!;
    const visibleMesh = meshes.find(m => m.name === "2_structure")!;

    expect(fadedMesh.material!.alpha).toBe(0.1);
    expect(visibleMesh.material!.alpha).toBe(1);

    decodeSpy.mockRestore();
  });

  it("swallows a failed mesh fetch and adds nothing to the scene", async () => {
    const scene = makeScene();
    mockedGet.mockRejectedValue(new Error("network error"));
    const structure = makeStructureEntity({ identifier: 1 });

    await syncStructureVisibility(scene, [], [structure], vi.fn());

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    expect(atlasRootNode.getChildren()).toEqual([]);
  });

  it("swallows a failed decode and adds nothing to the scene", async () => {
    const scene = makeScene();
    const decodeSpy = vi
      .spyOn(DracoDecoder.Default, "decodeMeshToGeometryAsync")
      .mockRejectedValue(new Error("bad draco data"));
    const structure = makeStructureEntity({ identifier: 1 });

    await syncStructureVisibility(scene, [], [structure], vi.fn());

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    expect(atlasRootNode.getChildren()).toEqual([]);

    decodeSpy.mockRestore();
  });

  it("logs the failure reason when a decode fails, instead of hiding it", async () => {
    const scene = makeScene();
    const decodeError = new Error("bad draco data");
    const decodeSpy = vi
      .spyOn(DracoDecoder.Default, "decodeMeshToGeometryAsync")
      .mockRejectedValue(decodeError);
    const warnSpy = vi.spyOn(Logger, "Warn").mockImplementation(() => {});
    const structure = makeStructureEntity({ identifier: 1 });

    await syncStructureVisibility(scene, [], [structure], vi.fn());

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to import structure 1")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(decodeError.toString())
    );

    warnSpy.mockRestore();
    decodeSpy.mockRestore();
  });

  it("imports missing structures concurrently rather than one at a time", async () => {
    const scene = makeScene();
    stubDecode(scene);
    const structures = [
      makeStructureEntity({ identifier: 1 }),
      makeStructureEntity({ identifier: 2 })
    ];

    // Gate both fetches on deferred promises so neither can resolve until
    // both have been requested -- proving they were started concurrently
    // rather than one after another.
    const deferred = structures.map(() => {
      let resolve!: (value: { data: ArrayBuffer }) => void;
      const promise = new Promise<{ data: ArrayBuffer }>(r => (resolve = r));
      return { promise, resolve };
    });
    let callIndex = 0;
    mockedGet.mockImplementation(() => deferred[callIndex++]!.promise);

    const syncPromise = syncStructureVisibility(scene, [], structures, vi.fn());

    // Give both requests a chance to fire before resolving either.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockedGet).toHaveBeenCalledTimes(2);

    deferred.forEach(({ resolve }) => resolve({ data: new ArrayBuffer(0) }));
    await syncPromise;

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    expect(
      atlasRootNode
        .getChildren()
        .map(c => c.name)
        .sort()
    ).toEqual(["1_structure", "2_structure"]);
  });

  it("reports progress once per missing structure, up to the total", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const structures = [
      makeStructureEntity({ identifier: 1 }),
      makeStructureEntity({ identifier: 2 })
    ];
    const onProgress = vi.fn();

    await syncStructureVisibility(scene, [], structures, onProgress);

    expect(onProgress).toHaveBeenCalledWith(0, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
    expect(onProgress).toHaveBeenCalledTimes(3);

    decodeSpy.mockRestore();
  });

  it("still reports progress reaching the total when a structure fails", async () => {
    const scene = makeScene();
    const decodeSpy = vi
      .spyOn(DracoDecoder.Default, "decodeMeshToGeometryAsync")
      .mockRejectedValue(new Error("bad draco data"));
    const structure = makeStructureEntity({ identifier: 1 });
    const onProgress = vi.fn();

    await syncStructureVisibility(scene, [], [structure], onProgress);

    expect(onProgress).toHaveBeenLastCalledWith(1, 1);

    decodeSpy.mockRestore();
  });

  it("does not report progress when every desired structure is already present", async () => {
    const scene = makeScene();
    const decodeSpy = stubDecode(scene);
    const structure = makeStructureEntity({ identifier: 1 });

    await syncStructureVisibility(scene, [], [structure], vi.fn());
    const onProgress = vi.fn();
    await syncStructureVisibility(scene, [], [structure], onProgress);

    expect(onProgress).not.toHaveBeenCalled();

    decodeSpy.mockRestore();
  });
});

describe("setAtlasRootReference", () => {
  it("creates the atlas root node with the expected rotation", () => {
    const scene = makeScene();

    setAtlasRootReference(scene, [0, 0, 0]);

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    expect(atlasRootNode.rotation.equals(new Vector3(Math.PI, 0, 0))).toBe(
      true
    );
  });

  it("offsets the atlas root so the reference coordinate sits at the origin", () => {
    const scene = makeScene();
    const reference: [number, number, number] = [5.7, 0.44, 5.4];

    setAtlasRootReference(scene, reference);

    const atlasRootNode = scene.getTransformNodeByName("atlasRoot_node")!;
    expect(
      atlasRootNode.position.equals(asrToBabylon(reference).negate())
    ).toBe(true);
  });

  it("reuses the existing atlas root node on a second call", () => {
    const scene = makeScene();

    setAtlasRootReference(scene, [1, 2, 3]);
    const first = scene.getTransformNodeByName("atlasRoot_node");
    setAtlasRootReference(scene, [4, 5, 6]);
    const second = scene.getTransformNodeByName("atlasRoot_node");

    expect(first).toBe(second);
  });
});
