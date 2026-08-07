import {
  createStore,
  delMany,
  get,
  keys,
  set,
  type UseStore
} from "idb-keyval";

/** IndexedDB database holding scene object models. */
const DATABASE_NAME = "pinpoint-v";
/** Object store holding one GLB blob per scene object id. */
const STORE_NAME = "scene-object-glb";
/** MIME type stored alongside each GLB blob. */
const GLB_MIME_TYPE = "model/gltf-binary";

/** Lazily created IndexedDB store handle, so importing this module never opens IndexedDB. */
let store: UseStore | null = null;

/** Get, or lazily create, this module's IndexedDB store handle. */
function sceneObjectGlbStore(): UseStore {
  store ??= createStore(DATABASE_NAME, STORE_NAME);
  return store;
}

/**
 * Store a scene object's GLB bytes in IndexedDB, keyed by its id.
 * @param sceneObjectId Scene object id to store the GLB under.
 * @param glbBytes GLB bytes to store.
 */
export async function putSceneObjectGlb(
  sceneObjectId: string,
  glbBytes: Uint8Array
): Promise<void> {
  await set(
    sceneObjectId,
    new Blob([glbBytes.slice()], { type: GLB_MIME_TYPE }),
    sceneObjectGlbStore()
  );
}

/**
 * Read a scene object's GLB bytes from IndexedDB, or null when none are stored.
 * @param sceneObjectId Scene object id whose GLB to read.
 */
export async function getSceneObjectGlb(
  sceneObjectId: string
): Promise<Uint8Array | null> {
  const blob = await get<Blob>(sceneObjectId, sceneObjectGlbStore());
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/**
 * Delete every stored GLB whose scene object id is not referenced, returning
 * the ids that were deleted.
 * @param referencedSceneObjectIds Scene object ids still referenced by any experiment.
 */
export async function pruneSceneObjectGlbs(
  referencedSceneObjectIds: Iterable<string>
): Promise<string[]> {
  const kept = new Set(referencedSceneObjectIds);
  const storedIds = await keys<string>(sceneObjectGlbStore());
  const staleIds = storedIds.filter(id => !kept.has(id));
  if (staleIds.length) await delMany(staleIds, sceneObjectGlbStore());
  return staleIds;
}
