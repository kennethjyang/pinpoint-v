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
});
