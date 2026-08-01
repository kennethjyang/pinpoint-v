import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import type { VueWrapper } from "@vue/test-utils";
import { useExperimentFile } from "./useExperimentFile";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { getManifest } from "@/features/atlas";
import { mountWithQuasar } from "@/test/mount-helper";
import { makeAtlas, makeManifest } from "@/test/fixtures";
import { serializeExperiment } from "../api/experiment-file.api";
import { buildExperiment } from "../api/experiment.api";

// Mock the leaf module (not the `@/features/atlas` barrel), matching the
// pattern in `current-experiment.store.spec.ts`.
vi.mock("@/features/atlas/api/source.api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/atlas/api/source.api")
  >("@/features/atlas/api/source.api");
  return {
    ...actual,
    getManifest: vi.fn(),
    getTerminologyRows: vi.fn()
  };
});

// `useFileDialog`'s input is never attached to the DOM, so it can't be
// driven through a queryable `<input type="file">` the way
// `InstallProbeDialog.spec.ts` drives its hidden input. Replace it with a
// fake that records the registered `onChange` callback and an `open` spy.
const openFileDialogSpy = vi.fn();
let capturedOnChange:
  | ((files: FileList | null) => void | Promise<void>)
  | null = null;

vi.mock("@vueuse/core", async importOriginal => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useFileDialog: () => ({
      files: { value: null },
      open: openFileDialogSpy,
      reset: vi.fn(),
      onChange: (
        callback: (files: FileList | null) => void | Promise<void>
      ) => {
        capturedOnChange = callback;
      },
      onCancel: vi.fn()
    })
  };
});

/**
 * Build a fake `FileList` containing a single file, matching what a real
 * file input's `change` event would provide.
 */
function makeFileList(file: File): FileList {
  return { 0: file, length: 1, item: () => file } as unknown as FileList;
}

const mockedGetManifest = vi.mocked(getManifest);

const Harness = defineComponent({
  setup() {
    return useExperimentFile();
  },
  template: "<div></div>"
});

type HarnessWrapper = VueWrapper<InstanceType<typeof Harness>>;

const mountedWrappers: HarnessWrapper[] = [];

function mountHarness(): HarnessWrapper {
  const wrapper = mountWithQuasar(Harness) as HarnessWrapper;
  mountedWrappers.push(wrapper);
  return wrapper;
}

async function flush() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe("useExperimentFile", () => {
  beforeEach(() => {
    openFileDialogSpy.mockReset();
    capturedOnChange = null;
    mockedGetManifest.mockReset().mockResolvedValue(makeManifest());
  });

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount());
  });

  describe("openExperiment", () => {
    it("opens the file dialog", () => {
      const wrapper = mountHarness();

      wrapper.vm.openExperiment();

      expect(openFileDialogSpy).toHaveBeenCalled();
    });
  });

  describe("loading a picked file", () => {
    it("loads a valid experiment file into the store", async () => {
      const wrapper = mountHarness();
      const store = useCurrentExperimentStore();
      const experiment = buildExperiment(
        "Loaded Experiment",
        makeAtlas(),
        [0, 0, 0]
      );
      const file = new File([serializeExperiment(experiment)], "e.json", {
        type: "application/json"
      });
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await capturedOnChange!(makeFileList(file));
      await flush();

      expect(store.name).toBe("Loaded Experiment");
      expect(notifySpy).not.toHaveBeenCalled();
    });

    it("fires onOpened after a successful load", async () => {
      const wrapper = mountHarness();
      const onOpenedSpy = vi.fn();
      wrapper.vm.onOpened(onOpenedSpy);
      const experiment = buildExperiment("Loaded", makeAtlas(), [0, 0, 0]);
      const file = new File([serializeExperiment(experiment)], "e.json", {
        type: "application/json"
      });

      await capturedOnChange!(makeFileList(file));
      await flush();

      expect(onOpenedSpy).toHaveBeenCalled();
    });

    it("notifies an error and leaves the store untouched for invalid JSON", async () => {
      const wrapper = mountHarness();
      const store = useCurrentExperimentStore();
      const originalName = store.name;
      const file = new File(["not json"], "e.json", {
        type: "application/json"
      });
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await capturedOnChange!(makeFileList(file));
      await flush();

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "negative" })
      );
      expect(store.name).toBe(originalName);
    });

    it("notifies an error for a well-formed JSON file that isn't an experiment", async () => {
      const wrapper = mountHarness();
      const file = new File(["{}"], "e.json", {
        type: "application/json"
      });
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await capturedOnChange!(makeFileList(file));
      await flush();

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "negative" })
      );
    });

    it("does nothing when the file list is null, as reset: true fires on open", async () => {
      const wrapper = mountHarness();
      const store = useCurrentExperimentStore();
      const originalName = store.name;
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await capturedOnChange!(null);
      await flush();

      expect(notifySpy).not.toHaveBeenCalled();
      expect(store.name).toBe(originalName);
    });

    it("notifies a warning when the loaded experiment's atlas can't be fetched", async () => {
      mockedGetManifest.mockResolvedValue(null);
      const wrapper = mountHarness();
      const store = useCurrentExperimentStore();
      const experiment = buildExperiment("Loaded", makeAtlas(), [0, 0, 0]);
      const file = new File([serializeExperiment(experiment)], "e.json", {
        type: "application/json"
      });
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await capturedOnChange!(makeFileList(file));
      await flush();

      expect(store.name).toBe("Loaded");
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "warning" })
      );
    });

    it("notifies an error when the file can't be read as text", async () => {
      const wrapper = mountHarness();
      const file = new File(["irrelevant"], "e.json", {
        type: "application/json"
      });
      vi.spyOn(file, "text").mockRejectedValue(new Error("read failed"));
      const notifySpy = vi.spyOn(wrapper.vm.$q, "notify");

      await capturedOnChange!(makeFileList(file));
      await flush();

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ color: "negative" })
      );
    });
  });

  describe("downloadExperiment", () => {
    it("triggers a download named after the current experiment", async () => {
      const wrapper = mountHarness();
      const store = useCurrentExperimentStore();
      store.experiment.name = "My Experiment";
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      wrapper.vm.downloadExperiment();
      await flush();

      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });
  });
});
