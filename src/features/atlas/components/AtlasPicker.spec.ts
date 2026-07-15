import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import axios from "axios";
import AtlasPicker from "./AtlasPicker.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useFavoriteAtlasesStore } from "@/stores/favorite-atlases.store";
import { makeAtlas } from "@/test/fixtures";

vi.mock("axios");

// axios.get is only ever passed to vi.mocked() to retrieve its mock, never
// called unbound.
// oxlint-disable-next-line typescript/unbound-method
const mockedGet = vi.mocked(axios.get);

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

  describe("v-model contract", () => {
    it("emits update:modelValue with the clicked atlas", async () => {
      mockedGet.mockResolvedValue({
        data: { files: [{ name: "allen_mouse", type: "folder" }] }
      });

      const wrapper = mountPicker();
      await connectButton(wrapper).trigger("click");
      await new Promise(resolve => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      await wrapper.findComponent({ name: "QItem" }).trigger("click");

      expect(wrapper.emitted("update:modelValue")).toEqual([
        [{ name: "allen_mouse", source: "http://localhost:3000" }]
      ]);
    });
  });
});
