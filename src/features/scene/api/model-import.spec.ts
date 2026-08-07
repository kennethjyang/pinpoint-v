import { beforeAll, describe, expect, it } from "vitest";
import {
  Color3,
  ImportMeshAsync,
  Mesh,
  MeshBuilder,
  NullEngine,
  Scene,
  StandardMaterial
} from "@babylonjs/core";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { importModelAsGlb } from "./model-import.api";
import { makeTestScene } from "@/test/mount-helper";

/** Little-endian `glTF` magic bytes every GLB starts with. */
const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46];

/** Distinct name a source model's material carries, to prove it doesn't survive re-encoding. */
const SOURCE_MATERIAL_NAME = "sourceRedMaterial";

// Mirrors the app boot's own registration: `ImportMeshAsync` needs the glTF
// plugin factory registered before it can claim a `.glb` file.
beforeAll(() => {
  registerBuiltInLoaders();
});

/**
 * Build GLB bytes for a 1 mm box colored with a distinctly named red material,
 * for tests proving source materials don't survive re-encoding.
 */
async function makeColoredTestGlbBytes(): Promise<Uint8Array> {
  const scene = makeTestScene();
  try {
    const box = MeshBuilder.CreateBox("box", { size: 1 }, scene);
    const material = new StandardMaterial(SOURCE_MATERIAL_NAME, scene);
    material.diffuseColor = Color3.Red();
    box.material = material;

    const data = await GLTF2Export.GLBAsync(scene, "box.glb", {
      exportWithoutWaitingForScene: true
    });
    const glb = Object.values(data.files).find(value => value instanceof Blob);
    return new Uint8Array(await (glb as Blob).arrayBuffer());
  } finally {
    scene.dispose();
  }
}

describe("importModelAsGlb", () => {
  it("re-encodes an imported model as GLB bytes with merged geometry, discarding the source material", async () => {
    const engine = new NullEngine();
    const glbBytes = await makeColoredTestGlbBytes();
    const file = new File([glbBytes.slice()], "box.glb", {
      type: "model/gltf-binary"
    });

    const result = await importModelAsGlb(engine, file);

    expect(result).not.toBeNull();
    expect(result!.slice(0, 4)).toEqual(Uint8Array.from(GLB_MAGIC));

    // Re-import the produced bytes into a fresh scene: exactly one vertexed
    // mesh proves the geometry merged, and a material whose name doesn't
    // match the source's proves that material was discarded.
    const verifyScene = new Scene(engine);
    try {
      const imported = await ImportMeshAsync(result!, verifyScene, {
        pluginExtension: ".glb"
      });
      const vertexedMeshes = imported.meshes.filter(
        (mesh): mesh is Mesh =>
          mesh instanceof Mesh && mesh.getTotalVertices() > 0
      );
      expect(vertexedMeshes).toHaveLength(1);
      expect(vertexedMeshes[0]!.material?.name).not.toBe(SOURCE_MATERIAL_NAME);
    } finally {
      verifyScene.dispose();
    }
  });

  it("resolves null (or rejects) for a file no loader can parse, leaving the engine's scenes untouched", async () => {
    const engine = new NullEngine();
    const originalSceneCount = engine.scenes.length;
    const file = new File(["not a model"], "broken.glb", {
      type: "model/gltf-binary"
    });

    let result: Uint8Array | null = null;
    try {
      result = await importModelAsGlb(engine, file);
    } catch {
      // A loader throw is an acceptable failure mode too.
    }

    expect(result).toBeNull();
    expect(engine.scenes.length).toBe(originalSceneCount);
  });
});
