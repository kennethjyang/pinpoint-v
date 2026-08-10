import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useCoordinateSystemLibraryStore } from "./coordinate-system-library.store";
import { makeCoordinateSystem } from "@/test/fixtures";

describe("useCoordinateSystemLibraryStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("remove", () => {
    it("drops the matching seeded entry", () => {
      const store = useCoordinateSystemLibraryStore();
      const target = store.library[1]!;

      store.remove(target);

      expect(store.library).toHaveLength(2);
      expect(store.library).not.toContain(target);
    });

    it("matches by id, not object identity", () => {
      const store = useCoordinateSystemLibraryStore();
      const target = store.library[0]!;

      store.remove({ ...target, name: "Renamed" });

      expect(store.library).toHaveLength(2);
      expect(store.library).not.toContain(target);
    });

    it("is a no-op for an unknown id", () => {
      const store = useCoordinateSystemLibraryStore();

      store.remove(makeCoordinateSystem());

      expect(store.library).toHaveLength(3);
    });
  });

  describe("seeded library", () => {
    it("recreates the three seeds by name, in order", () => {
      const store = useCoordinateSystemLibraryStore();

      expect(store.library.map(({ name }) => name)).toEqual([
        "CCF",
        "Sensapex uMp-4 Surface Coordinate & Depth",
        "NewScale MIS"
      ]);
    });

    it("carries the fixed Radius value on the NewScale MIS chain", () => {
      const store = useCoordinateSystemLibraryStore();

      expect(store.library[2]!.chain[1]!.position[2]).toEqual({
        name: "Radius",
        value: 20,
        fixed: true,
        bounds: null
      });
    });

    it("carries the X/Y/Depth position values on the final NewScale MIS node", () => {
      const store = useCoordinateSystemLibraryStore();
      const position = store.library[2]!.chain[2]!.position;

      expect(position.map(({ name }) => name)).toEqual(["X", "Y", "Depth"]);
      for (const value of position) {
        expect(value.bounds).toEqual([-7.5, 7.5]);
      }
      expect(position[2]!.value).toBe(20);
    });

    it("carries the Pitch bounds on the Sensapex chain", () => {
      const store = useCoordinateSystemLibraryStore();

      expect(store.library[1]!.chain[0]!.rotation[0]!.bounds).toEqual([
        -Math.PI / 2,
        Math.PI / 2
      ]);
    });

    it("defaults every node's display orders to identity", () => {
      const store = useCoordinateSystemLibraryStore();

      for (const coordinateSystem of store.library) {
        for (const node of coordinateSystem.chain) {
          expect(node.positionDisplayOrder).toEqual([0, 1, 2]);
          expect(node.rotationDisplayOrder).toEqual([0, 1, 2]);
        }
      }
    });
  });
});
