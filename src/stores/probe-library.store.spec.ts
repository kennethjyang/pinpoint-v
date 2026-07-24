import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useProbeLibraryStore } from "./probe-library.store";
import { makeProbe } from "@/test/fixtures";

describe("useProbeLibraryStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("add", () => {
    it("adds a probe to the library", () => {
      const store = useProbeLibraryStore();
      const probe = makeProbe();

      store.add(probe);

      expect(store.library).toEqual([probe]);
    });

    it("dedups structurally equal probes, even as distinct object instances", () => {
      const store = useProbeLibraryStore();

      store.add(makeProbe());
      store.add(makeProbe());

      expect(store.library).toEqual([makeProbe()]);
    });

    it("keeps distinct probes in the library", () => {
      const store = useProbeLibraryStore();

      store.add(makeProbe({ si_units: "um" }));
      store.add(makeProbe({ si_units: "mm" }));

      expect(store.library).toEqual([
        makeProbe({ si_units: "um" }),
        makeProbe({ si_units: "mm" })
      ]);
    });
  });

  describe("remove", () => {
    it("removes a structurally equal probe from the library", () => {
      const store = useProbeLibraryStore();
      store.add(makeProbe());

      store.remove(makeProbe());

      expect(store.library).toEqual([]);
    });

    it("removes all structurally equal instances", () => {
      const store = useProbeLibraryStore();
      store.library.push(makeProbe(), makeProbe());

      store.remove(makeProbe());

      expect(store.library).toEqual([]);
    });

    it("is a no-op when the probe doesn't exist", () => {
      const store = useProbeLibraryStore();
      store.add(makeProbe({ si_units: "um" }));

      store.remove(makeProbe({ si_units: "mm" }));

      expect(store.library).toEqual([makeProbe({ si_units: "um" })]);
    });
  });
});
