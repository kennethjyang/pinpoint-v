import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSceneObjectGlb,
  putSceneObjectGlb,
  pruneSceneObjectGlbs
} from "./scene-object-glb.api";

// In-memory replacement for the real IndexedDB-backed store, keyed the same
// way `idb-keyval`'s default store is: a single flat map of key -> value.
const memoryStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  createStore: () => "fake-store",
  get: async (key: string) => memoryStore.get(key),
  set: async (key: string, value: unknown) => {
    memoryStore.set(key, value);
  },
  del: async (key: string) => {
    memoryStore.delete(key);
  },
  delMany: async (keysToDelete: string[]) => {
    for (const key of keysToDelete) memoryStore.delete(key);
  },
  keys: async () => [...memoryStore.keys()]
}));

beforeEach(() => {
  memoryStore.clear();
});

describe("putSceneObjectGlb / getSceneObjectGlb", () => {
  it("round-trips bytes through the store", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await putSceneObjectGlb("a", bytes);
    const read = await getSceneObjectGlb("a");

    expect(read).toEqual(bytes);
  });

  it("returns null for an unknown id", async () => {
    expect(await getSceneObjectGlb("missing")).toBeNull();
  });
});

describe("pruneSceneObjectGlbs", () => {
  it("deletes only the ids not referenced, and returns them", async () => {
    await putSceneObjectGlb("a", new Uint8Array([1]));
    await putSceneObjectGlb("b", new Uint8Array([2]));

    const deleted = await pruneSceneObjectGlbs(["a"]);

    expect(deleted).toEqual(["b"]);
    expect(await getSceneObjectGlb("a")).toEqual(new Uint8Array([1]));
    expect(await getSceneObjectGlb("b")).toBeNull();
  });

  it("deletes nothing and returns an empty list when every id is referenced", async () => {
    await putSceneObjectGlb("a", new Uint8Array([1]));

    const deleted = await pruneSceneObjectGlbs(["a"]);

    expect(deleted).toEqual([]);
    expect(await getSceneObjectGlb("a")).toEqual(new Uint8Array([1]));
  });
});
