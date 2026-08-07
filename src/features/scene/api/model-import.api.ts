import {
  type AbstractEngine,
  Camera,
  ImportMeshAsync,
  Light,
  type Material,
  Mesh,
  Scene
} from "@babylonjs/core";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0";
import { orientNormalsOutward } from "./mesh-orientation.api";

/** File name handed to the GLB exporter; only its extension matters. */
const EXPORT_FILE_NAME = "object.glb";

/**
 * Import a picked 3D model file and re-encode its merged, material-less geometry
 * as GLB bytes, or null when the file holds no importable mesh.
 * @param engine Engine hosting the throwaway import scene.
 * @param file Model file picked by the user.
 */
export async function importModelAsGlb(
  engine: AbstractEngine,
  file: File
): Promise<Uint8Array | null> {
  const scene = new Scene(engine);
  try {
    const result = await ImportMeshAsync(file, scene, {});
    const meshes = result.meshes.filter(
      (mesh): mesh is Mesh =>
        mesh instanceof Mesh && mesh.getTotalVertices() > 0
    );
    if (!meshes.length) return null;

    const importedMaterials = new Set<Material>();
    for (const mesh of meshes) {
      if (mesh.material) importedMaterials.add(mesh.material);
    }

    // `multiMultiMaterials: false` keeps the result a single primitive; the scene
    // applies its own colored material when it rebuilds from these bytes, so
    // nothing from the source file's materials is worth carrying.
    const merged = Mesh.MergeMeshes(
      meshes,
      true,
      true,
      undefined,
      false,
      false
    );
    if (!merged) return null;

    // Source files can carry stale, missing, or inward-facing normals; recompute
    // them from the merged topology, oriented outward, so lighting reads
    // correctly regardless of origin.
    orientNormalsOutward(merged);
    merged.material = null;
    for (const material of importedMaterials) material.dispose(false, true);

    const data = await GLTF2Export.GLBAsync(scene, EXPORT_FILE_NAME, {
      shouldExportNode: node =>
        !(node instanceof Camera) && !(node instanceof Light),
      exportWithoutWaitingForScene: true
    });
    const glb = Object.values(data.files).find(value => value instanceof Blob);
    return glb ? new Uint8Array(await glb.arrayBuffer()) : null;
  } finally {
    scene.dispose();
  }
}
