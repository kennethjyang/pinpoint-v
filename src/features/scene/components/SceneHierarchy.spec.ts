import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import SceneHierarchy from "./SceneHierarchy.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useProbeLibraryStore } from "@/stores/probe-library.store";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import {
  getAtlasCenter,
  getManifest,
  getTerminologyRows
} from "@/features/atlas";
import { makeProbe } from "@/test/fixtures";

// `useCurrentExperimentStore`'s `manifest`/`terminologyRows` are
// `computedAsync` and fetch on store creation -- mock the leaf module (not
// the `@/features/atlas` barrel) or mounting triggers real network calls.
// Mirrors the mocking approach in SceneCanvas.spec.ts.
vi.mock("@/features/atlas/api/source.api", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/atlas/api/source.api")
  >("@/features/atlas/api/source.api");
  return {
    ...actual,
    getManifest: vi.fn(),
    getTerminologyRows: vi.fn(),
    getAtlasCenter: vi.fn()
  };
});

// The "Add Probe" dropdown's content is teleported to `document.body`
// rather than into `wrapper.element`'s subtree (Quasar's `QMenu`), so each
// mounted instance must be attached to, and torn down from, `document.body`
// -- otherwise a leftover teleported node from one test could be picked up
// by `document.body.querySelector` in another. Mirrors the approach in
// ProbeLibraryDialog.spec.ts.
const mountedWrappers: VueWrapper[] = [];

async function mountHierarchy(pinia: Pinia) {
  const wrapper = mountWithQuasar(SceneHierarchy, {
    pinia,
    attachTo: document.body
  });
  mountedWrappers.push(wrapper);
  return wrapper;
}

/**
 * Open the "Add Probe" dropdown and click its first library entry.
 */
async function pickFirstLibraryProbe() {
  document
    .querySelector<HTMLButtonElement>(".q-btn-dropdown__arrow-container")
    ?.closest("button")
    ?.click();
  await new Promise(resolve => setTimeout(resolve));

  const entry = document.querySelector<HTMLElement>("[role='menu'] .q-item");
  entry?.click();
  await new Promise(resolve => setTimeout(resolve));
}

describe("SceneHierarchy", () => {
  beforeEach(() => {
    vi.mocked(getManifest).mockResolvedValue(null);
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
    vi.mocked(getAtlasCenter).mockReturnValue([0, 0, 0]);
  });

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount());
  });

  it("interns the picked library probe's definition before adding a probe", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const probeLibrary = useProbeLibraryStore(pinia);
    const currentExperiment = useCurrentExperimentStore(pinia);
    const spec = makeProbe({
      annotations: { manufacturer: "imec", model_name: "np1" }
    });
    probeLibrary.add(spec);

    await mountHierarchy(pinia);
    await pickFirstLibraryProbe();

    expect(currentExperiment.probes).toHaveLength(1);
    const [probe] = currentExperiment.probes;
    expect(currentExperiment.probeInterfaceProbeFor(probe!)).toEqual(spec);
  });

  it("reuses the same definition id when the same probe is added twice", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const probeLibrary = useProbeLibraryStore(pinia);
    const currentExperiment = useCurrentExperimentStore(pinia);
    probeLibrary.add(makeProbe());

    await mountHierarchy(pinia);
    await pickFirstLibraryProbe();
    await pickFirstLibraryProbe();

    expect(currentExperiment.probes).toHaveLength(2);
    expect(currentExperiment.probeInterfaceProbes).toHaveLength(1);
    const [a, b] = currentExperiment.probes;
    expect(a!.probeInterfaceProbeId).toBe(b!.probeInterfaceProbeId);
  });

  it("removes a probe's definition from the experiment along with the probe", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const probeLibrary = useProbeLibraryStore(pinia);
    const currentExperiment = useCurrentExperimentStore(pinia);
    probeLibrary.add(makeProbe());

    const wrapper = await mountHierarchy(pinia);
    await pickFirstLibraryProbe();

    const deleteButton = wrapper
      .findAllComponents({ name: "QBtn" })
      .find(btn => btn.props("icon") === "delete")!;
    await deleteButton.trigger("click");

    expect(currentExperiment.probes).toEqual([]);
    expect(currentExperiment.probeInterfaceProbes).toEqual([]);
  });
});
