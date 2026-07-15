import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import axios from "axios";
import AtlasPicker from "./AtlasPicker.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useFavoriteAtlasesStore } from "@/stores/favorite-atlases.store";
import {
  checkAtlasCompatibility,
  ConverterCompatibility
} from "@/features/atlas";
import { makeAtlas, makeAtlasMetadata } from "@/test/fixtures";

vi.mock("axios");

// Delegates to the real implementation by default so most tests exercise the
// actual compatibility logic; individual tests can override with
// mockReturnValueOnce for cases that aren't reachable via a real APP_VERSION
// (e.g. a minor mismatch where Pinpoint is newer, since the app's minor is 0).
vi.mock("@/features/atlas", async importOriginal => {
  const actual = await importOriginal<typeof import("@/features/atlas")>();
  return {
    ...actual,
    checkAtlasCompatibility: vi.fn(actual.checkAtlasCompatibility)
  };
});

// axios.get is only ever passed to vi.mocked() to retrieve its mock, never
// called unbound.
// oxlint-disable-next-line typescript/unbound-method
const mockedGet = vi.mocked(axios.get);
const mockedCheckAtlasCompatibility = vi.mocked(checkAtlasCompatibility);

function mountPicker(
  modelValue: ReturnType<typeof makeAtlas> | null = null,
  pinia = createPinia()
) {
  return mountWithQuasar(AtlasPicker, {
    pinia,
    props: { modelValue, "onUpdate:modelValue": () => {} }
  });
}

function connectButton(wrapper: ReturnType<typeof mountPicker>) {
  return wrapper
    .findAllComponents({ name: "QBtn" })
    .find(btn => btn.text().includes("Connect"))!;
}

describe("AtlasPicker", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedGet.mockReset();
    mockedCheckAtlasCompatibility.mockClear();
  });

  describe("connect", () => {
    it("populates atlases and connects on a successful folder-only response", async () => {
      mockedGet.mockResolvedValue({
        data: {
          files: [
            { name: "allen_mouse", type: "folder" },
            { name: "readme.txt", type: "file" }
          ]
        }
      });

      const wrapper = mountPicker();
      await connectButton(wrapper).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Connected state renders the atlas list; the folder-only atlas shows,
      // the file entry is excluded.
      const items = wrapper.findAllComponents({ name: "QItem" });
      expect(items).toHaveLength(1);
      expect(items[0]!.text()).toContain("allen_mouse");
    });

    it("notifies and stays disconnected when the response has no data", async () => {
      mockedGet.mockResolvedValue({ data: null });

      const wrapper = mountPicker();
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await connectButton(wrapper).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "negative" })
      );
      expect(wrapper.findAllComponents({ name: "QItem" })).toHaveLength(0);
    });

    it("notifies and stays disconnected when the request throws", async () => {
      mockedGet.mockRejectedValue(new Error("network error"));

      const wrapper = mountPicker();
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await connectButton(wrapper).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "negative" })
      );
      expect(wrapper.findAllComponents({ name: "QItem" })).toHaveLength(0);
    });
  });

  describe("favorites partitioning", () => {
    async function connectedWrapper(pinia: ReturnType<typeof createPinia>) {
      mockedGet.mockResolvedValue({
        data: {
          files: [
            { name: "allen_mouse", type: "folder" },
            { name: "allen_human", type: "folder" }
          ]
        }
      });

      const wrapper = mountPicker(null, pinia);
      await connectButton(wrapper).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
      return wrapper;
    }

    it("renders favorited atlases separately from the rest", async () => {
      const pinia = createPinia();
      setActivePinia(pinia);
      const favoritesStore = useFavoriteAtlasesStore();
      favoritesStore.add(
        makeAtlas({ source: "http://localhost:3000", name: "allen_human" })
      );

      const wrapper = await connectedWrapper(pinia);

      const items = wrapper.findAllComponents({ name: "QItem" });
      // Favorites render first: allen_human (favorite) then allen_mouse.
      expect(items.map(i => i.text())).toEqual([
        expect.stringContaining("allen_human"),
        expect.stringContaining("allen_mouse")
      ]);
    });

    it("adds an atlas to favorites when its favorite_border button is clicked", async () => {
      const pinia = createPinia();
      setActivePinia(pinia);

      const wrapper = await connectedWrapper(pinia);
      const favoritesStore = useFavoriteAtlasesStore();

      const addBtn = wrapper
        .findAllComponents({ name: "QBtn" })
        .find(btn => btn.props("icon") === "favorite_border")!;
      await addBtn.trigger("click");

      expect(favoritesStore.favorites["http://localhost:3000"]).toContain(
        "allen_human"
      );
    });

    it("removes an atlas from favorites when its favorite button is clicked", async () => {
      const pinia = createPinia();
      setActivePinia(pinia);
      const favoritesStore = useFavoriteAtlasesStore();
      favoritesStore.add(
        makeAtlas({ source: "http://localhost:3000", name: "allen_human" })
      );

      const wrapper = await connectedWrapper(pinia);

      const removeBtn = wrapper
        .findAllComponents({ name: "QBtn" })
        .find(btn => btn.props("icon") === "favorite")!;
      await removeBtn.trigger("click");

      expect(favoritesStore.favorites["http://localhost:3000"]).not.toContain(
        "allen_human"
      );
    });
  });

  describe("converter compatibility", () => {
    async function connectedWrapper() {
      mockedGet.mockResolvedValueOnce({
        data: { files: [{ name: "allen_mouse", type: "folder" }] }
      });

      const wrapper = mountPicker();
      await connectButton(wrapper).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
      return wrapper;
    }

    async function selectFirstAtlas(
      wrapper: Awaited<ReturnType<typeof connectedWrapper>>
    ) {
      await wrapper.findComponent({ name: "QItem" }).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
    }

    it("emits update:modelValue with the clicked atlas when compatible", async () => {
      const wrapper = await connectedWrapper();
      mockedGet.mockResolvedValueOnce({
        data: makeAtlasMetadata({
          version: import.meta.env.APP_VERSION
        })
      });

      await selectFirstAtlas(wrapper);

      expect(wrapper.emitted("update:modelValue")).toEqual([
        [{ name: "allen_mouse", source: "http://localhost:3000" }]
      ]);
    });

    it("blocks selection and notifies negatively on a major version mismatch", async () => {
      const wrapper = await connectedWrapper();
      mockedGet.mockResolvedValueOnce({
        data: makeAtlasMetadata({ version: "1.0.0" })
      });
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await selectFirstAtlas(wrapper);

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "negative" })
      );
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });

    it("warns but still selects on a minor version mismatch where Pinpoint is newer", async () => {
      const wrapper = await connectedWrapper();
      mockedGet.mockResolvedValueOnce({ data: makeAtlasMetadata() });
      // A real APP_VERSION with a newer minor than any converter version isn't
      // guaranteed to exist, so stub the compatibility check for this case.
      mockedCheckAtlasCompatibility.mockReturnValueOnce(
        ConverterCompatibility.Warn
      );
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await selectFirstAtlas(wrapper);

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "warning" })
      );
      expect(wrapper.emitted("update:modelValue")).toEqual([
        [{ name: "allen_mouse", source: "http://localhost:3000" }]
      ]);
    });

    it("blocks selection when the atlas metadata can't be fetched", async () => {
      const wrapper = await connectedWrapper();
      mockedGet.mockRejectedValueOnce(new Error("network error"));
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await selectFirstAtlas(wrapper);

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "negative" })
      );
      expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    });
  });
});
