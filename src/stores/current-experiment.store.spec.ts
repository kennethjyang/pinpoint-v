import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { useCurrentExperimentStore } from "./current-experiment.store";
import { fetchAtlasMetadata, getDefaultStructureIds } from "@/features/atlas";
import { makeAtlas, makeAtlasMetadata } from "@/test/fixtures";

vi.mock("@/features/atlas", () => ({
  fetchAtlasMetadata: vi.fn(),
  getDefaultStructureIds: vi.fn()
}));

describe("useCurrentExperimentStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(fetchAtlasMetadata).mockReset();
    vi.mocked(getDefaultStructureIds).mockReset();
    // Default the async metadata fetch to "not found" so tests that don't
    // care about it don't hang on a never-resolving promise.
    vi.mocked(fetchAtlasMetadata).mockResolvedValue(null);
  });

  describe("create", () => {
    it("replaces the experiment and resets visibleStructures", () => {
      const store = useCurrentExperimentStore();
      const atlas = makeAtlas({ name: "allen_human" });

      store.create("New Experiment", atlas, [1, 2, 3]);

      expect(store.name).toBe("New Experiment");
      expect(store.atlas).toEqual(atlas);
      expect(store.referenceCoordinate).toEqual([1, 2, 3]);
      expect(store.visibleStructures).toEqual([]);
    });
  });

  describe("setName", () => {
    it("updates the experiment's name", () => {
      const store = useCurrentExperimentStore();
      store.setName("Renamed");
      expect(store.name).toBe("Renamed");
    });
  });

  describe("setReferenceCoordinate", () => {
    it("updates the experiment's reference coordinate", () => {
      const store = useCurrentExperimentStore();
      store.setReferenceCoordinate([1, 1, 1]);
      expect(store.referenceCoordinate).toEqual([1, 1, 1]);
    });
  });

  describe("visibleStructures", () => {
    it("get returns the experiment's visibleStructures", () => {
      const store = useCurrentExperimentStore();
      expect(store.visibleStructures).toEqual([]);
    });

    it("set replaces the experiment's visibleStructures", () => {
      const store = useCurrentExperimentStore();
      store.visibleStructures = [1, 2];
      expect(store.experiment.visibleStructures).toEqual([1, 2]);
    });
  });

  describe("isStructureVisible", () => {
    it("returns true when the id is in visibleStructures", () => {
      const store = useCurrentExperimentStore();
      store.visibleStructures = [5];
      expect(store.isStructureVisible(5)).toBe(true);
    });

    it("returns false when the id is not in visibleStructures", () => {
      const store = useCurrentExperimentStore();
      expect(store.isStructureVisible(5)).toBe(false);
    });
  });

  describe("setStructureVisibility", () => {
    it("adds the id when setting visible and not already present", () => {
      const store = useCurrentExperimentStore();
      store.setStructureVisibility(5, true);
      expect(store.visibleStructures).toEqual([5]);
    });

    it("does not duplicate the id when already visible", () => {
      const store = useCurrentExperimentStore();
      store.visibleStructures = [5];
      store.setStructureVisibility(5, true);
      expect(store.visibleStructures).toEqual([5]);
    });

    it("removes the id when setting invisible and present", () => {
      const store = useCurrentExperimentStore();
      store.visibleStructures = [5, 6];
      store.setStructureVisibility(5, false);
      expect(store.visibleStructures).toEqual([6]);
    });

    it("is a no-op when setting invisible and not present", () => {
      const store = useCurrentExperimentStore();
      store.visibleStructures = [6];
      store.setStructureVisibility(5, false);
      expect(store.visibleStructures).toEqual([6]);
    });
  });

  describe("clearVisibleStructures", () => {
    it("resets visibleStructures to []", () => {
      const store = useCurrentExperimentStore();
      store.visibleStructures = [1, 2, 3];
      store.clearVisibleStructures();
      expect(store.visibleStructures).toEqual([]);
    });
  });

  describe("defaultStructureIds", () => {
    it("is [] while metadata hasn't resolved / is null", async () => {
      const store = useCurrentExperimentStore();
      await flushPromises();
      expect(store.defaultStructureIds).toEqual([]);
    });

    it("delegates to getDefaultStructureIds once metadata resolves", async () => {
      const metadata = makeAtlasMetadata();
      vi.mocked(fetchAtlasMetadata).mockResolvedValue(metadata);
      vi.mocked(getDefaultStructureIds).mockReturnValue([7, 8]);

      const store = useCurrentExperimentStore();
      await flushPromises();

      expect(store.metadata).toEqual(metadata);
      // defaultStructureIds is a lazy computed - read it before asserting on
      // the mock it delegates to.
      expect(store.defaultStructureIds).toEqual([7, 8]);
      expect(getDefaultStructureIds).toHaveBeenCalledWith(metadata);
    });
  });
});
