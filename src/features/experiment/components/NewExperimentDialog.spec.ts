import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import NewExperimentDialog from "./NewExperimentDialog.vue";
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

type DialogWrapper = VueWrapper<
  InstanceType<typeof NewExperimentDialog> & { show(): void }
>;

async function flush() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

// Dialog content is teleported to `document.body` rather than into
// `wrapper.element`'s subtree, so each mounted dialog must be unmounted after
// its test or a later test's `document.body.querySelector` could pick up a
// leftover teleported node from a previous test.
const mountedWrappers: DialogWrapper[] = [];

// The dialog plugin only renders its content once `show()` (exposed by
// useDialogPluginComponent) is called, and needs to be attached to the DOM
// for its teleported content to be queryable.
async function mountDialog(): Promise<DialogWrapper> {
  const wrapper = mountWithQuasar(NewExperimentDialog, {
    attachTo: document.body,
    global: {
      stubs: { AtlasPicker: true }
    }
  }) as DialogWrapper;
  mountedWrappers.push(wrapper);
  wrapper.vm.show();
  await wrapper.vm.$nextTick();
  await flush();
  return wrapper;
}

function createButton(wrapper: DialogWrapper) {
  return wrapper
    .findAllComponents({ name: "QBtn" })
    .find(btn => btn.text().includes("Create"))!;
}

describe("NewExperimentDialog", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(fetchAtlasMetadata).mockReset();
  });

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount());
  });

  describe("isCreateDisabled", () => {
    it("disables the create button when name and atlas are unset", async () => {
      const wrapper = await mountDialog();
      expect(createButton(wrapper).props("disable")).toBe(true);
    });

    it("stays disabled with only a name set", async () => {
      const wrapper = await mountDialog();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");

      expect(createButton(wrapper).props("disable")).toBe(true);
    });

    it("enables once both name and atlas are set", async () => {
      const wrapper = await mountDialog();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");
      await wrapper
        .findComponent({ name: "AtlasPicker" })
        .vm.$emit("update:modelValue", makeAtlas());

      expect(createButton(wrapper).props("disable")).toBe(false);
    });
  });

  describe("create", () => {
    it("seeds the reference coordinate from the atlas's metadata when available", async () => {
      const atlas = makeAtlas();
      const metadata = makeAtlasMetadata({
        defaultReferenceCoordinate: [1, 2, 3]
      });
      vi.mocked(fetchAtlasMetadata).mockResolvedValue(metadata);

      const wrapper = await mountDialog();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");
      await wrapper
        .findComponent({ name: "AtlasPicker" })
        .vm.$emit("update:modelValue", atlas);

      await createButton(wrapper).trigger("click");
      await flush();

      const store = useCurrentExperimentStore();
      expect(store.name).toBe("My Experiment");
      expect(store.atlas).toEqual(atlas);
      expect(store.referenceCoordinate).toEqual([1, 2, 3]);
    });

    it("falls back to [0, 0, 0] when metadata can't be fetched", async () => {
      const atlas = makeAtlas();
      vi.mocked(fetchAtlasMetadata).mockResolvedValue(null);

      const wrapper = await mountDialog();
      await wrapper.findComponent({ name: "QInput" }).setValue("My Experiment");
      await wrapper
        .findComponent({ name: "AtlasPicker" })
        .vm.$emit("update:modelValue", atlas);

      await createButton(wrapper).trigger("click");
      await flush();

      const store = useCurrentExperimentStore();
      expect(store.referenceCoordinate).toEqual([0, 0, 0]);
    });

    it("does nothing when name or atlas is missing", async () => {
      const wrapper = await mountDialog();
      const store = useCurrentExperimentStore();
      const createSpy = vi.spyOn(store, "create");

      await createButton(wrapper).trigger("click");
      await flush();

      // Note: fetchAtlasMetadata is also called by the store's own
      // computedAsync `metadata` on store init, so assert on the store
      // mutation `create()` guards on rather than the shared mock.
      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
