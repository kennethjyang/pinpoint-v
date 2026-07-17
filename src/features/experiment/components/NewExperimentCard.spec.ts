import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import NewExperimentCard from "./NewExperimentCard.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { fetchAtlasMetadata } from "@/features/atlas";
import { makeAtlas, makeAtlasMetadata } from "@/test/fixtures";

vi.mock("@/features/atlas/api/metadata.api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/atlas/api/metadata.api")
  >("@/features/atlas/api/metadata.api");
  return { ...actual, fetchAtlasMetadata: vi.fn() };
});

function mountCard() {
  return mountWithQuasar(NewExperimentCard, {
    global: {
      stubs: { AtlasPicker: true }
    }
  });
}

describe("NewExperimentCard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(fetchAtlasMetadata).mockReset();
  });

  describe("isCreateDisabled", () => {
    it("disables the create button when name and atlas are unset", () => {
      const wrapper = mountCard();
      const button = wrapper.findComponent({ name: "QBtn" });
      expect(button.props("disable")).toBe(true);
    });

    it("stays disabled with only a name set", async () => {
      const wrapper = mountCard();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");

      const button = wrapper.findComponent({ name: "QBtn" });
      expect(button.props("disable")).toBe(true);
    });

    it("enables once both name and atlas are set", async () => {
      const wrapper = mountCard();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");
      await wrapper
        .findComponent({ name: "AtlasPicker" })
        .vm.$emit("update:modelValue", makeAtlas());

      const button = wrapper.findComponent({ name: "QBtn" });
      expect(button.props("disable")).toBe(false);
    });
  });

  describe("create", () => {
    it("seeds the reference coordinate from the atlas's metadata when available", async () => {
      const atlas = makeAtlas();
      const metadata = makeAtlasMetadata({
        defaultReferenceCoordinate: [1, 2, 3]
      });
      vi.mocked(fetchAtlasMetadata).mockResolvedValue(metadata);

      const wrapper = mountCard();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");
      await wrapper
        .findComponent({ name: "AtlasPicker" })
        .vm.$emit("update:modelValue", atlas);

      await wrapper.findComponent({ name: "QBtn" }).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));

      const store = useCurrentExperimentStore();
      expect(store.name).toBe("My Experiment");
      expect(store.atlas).toEqual(atlas);
      expect(store.referenceCoordinate).toEqual([1, 2, 3]);
    });

    it("falls back to [0, 0, 0] when metadata can't be fetched", async () => {
      const atlas = makeAtlas();
      vi.mocked(fetchAtlasMetadata).mockResolvedValue(null);

      const wrapper = mountCard();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");
      await wrapper
        .findComponent({ name: "AtlasPicker" })
        .vm.$emit("update:modelValue", atlas);

      await wrapper.findComponent({ name: "QBtn" }).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));

      const store = useCurrentExperimentStore();
      expect(store.referenceCoordinate).toEqual([0, 0, 0]);
    });

    it("does nothing when name or atlas is missing", async () => {
      const wrapper = mountCard();
      const store = useCurrentExperimentStore();
      const createSpy = vi.spyOn(store, "create");

      await wrapper.findComponent({ name: "QBtn" }).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));

      // Note: fetchAtlasMetadata is also called by the store's own
      // computedAsync `metadata` on store init, so assert on the store
      // mutation `create()` guards on rather than the shared mock.
      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
