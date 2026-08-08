import { afterEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import CoordinateSystemLibraryDialog from "./CoordinateSystemLibraryDialog.vue";
import {
  createWrapperRegistry,
  mountDialogWithQuasar
} from "@/test/mount-helper";
import { useCoordinateSystemLibraryStore } from "@/stores/coordinate-system-library.store";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";

// Mock the leaf module (not the `@/features/atlas` barrel) -- the current
// experiment store's `terminologyRows` is a `computedAsync` and fetches on
// store creation, so mounting this dialog would trigger real network calls
// otherwise.
vi.mock("@/features/atlas/api/source.api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/atlas/api/source.api")
  >("@/features/atlas/api/source.api");
  return {
    ...actual,
    getTerminologyRows: vi.fn()
  };
});

type DialogWrapper = VueWrapper<
  InstanceType<typeof CoordinateSystemLibraryDialog> & { show(): void }
>;

const wrappers = createWrapperRegistry<DialogWrapper>();

async function mountDialog(): Promise<DialogWrapper> {
  return wrappers.track(
    (await mountDialogWithQuasar(
      CoordinateSystemLibraryDialog
    )) as DialogWrapper
  );
}

describe("CoordinateSystemLibraryDialog", () => {
  afterEach(() => {
    wrappers.unmountAll();
  });

  it("renders one QItem per library entry with its name", async () => {
    const wrapper = await mountDialog();
    const store = useCoordinateSystemLibraryStore();

    const items = wrapper.findAllComponents({ name: "QItem" });

    expect(items.map(item => item.text())).toEqual(
      store.library.map(coordinateSystem =>
        expect.stringContaining(coordinateSystem.name)
      )
    );
  });

  it("does not remove the coordinate system immediately on delete", async () => {
    const wrapper = await mountDialog();
    const store = useCoordinateSystemLibraryStore();
    const notify = vi.fn();
    wrapper.vm.$q.notify = notify;

    const firstItem = wrapper.findAllComponents({ name: "QItem" })[0]!;
    await firstItem.findComponent({ name: "QBtn" }).trigger("click");

    expect(store.library).toHaveLength(3);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("CCF") })
    );
  });

  it("removes the coordinate system when the delete confirmation is accepted", async () => {
    const wrapper = await mountDialog();
    const store = useCoordinateSystemLibraryStore();
    const notify = vi.fn();
    wrapper.vm.$q.notify = notify;

    const firstItem = wrapper.findAllComponents({ name: "QItem" })[0]!;
    await firstItem.findComponent({ name: "QBtn" }).trigger("click");
    const options = notify.mock.calls[0]![0];
    options.actions[1].handler();

    expect(store.library).toHaveLength(2);
    expect(store.library.map(({ name }) => name)).not.toContain("CCF");
  });

  it("selects the coordinate system and closes the dialog on row click", async () => {
    const wrapper = await mountDialog();
    const store = useCoordinateSystemLibraryStore();
    const currentExperimentStore = useCurrentExperimentStore();

    const firstItem = wrapper.findAllComponents({ name: "QItem" })[0]!;
    await firstItem.trigger("click");

    expect(currentExperimentStore.selectedInspectable).toBe(store.library[0]);
    expect(wrapper.emitted("ok")).toBeTruthy();
  });
});
