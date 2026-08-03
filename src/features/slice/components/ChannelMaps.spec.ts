import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import ChannelMapCanvas from "./ChannelMapCanvas.vue";
import ChannelMaps from "./ChannelMaps.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { makeProbe, makeProbeInterfaceProbe } from "@/test/fixtures";
import { getManifest, getTerminologyRows } from "@/features/atlas";
import { internProbeInterfaceProbe } from "@/features/experiment";
import { getProbeInterfaceIdentifier } from "@/features/probe";

// Mirrors SliceCanvas.spec.ts: manifest/terminologyRows are computedAsync and
// fetch on store creation, so the leaf module must be mocked or mounting
// triggers real network calls.
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

// ChannelMapCanvas owns its sampler internally, so the composable module is
// mocked to avoid a real worker/zarr fetch; this spec never inspects the
// stream's result, only that the canvas mounts and unmounts with visibility.
vi.mock("../composable/useAnnotationSampler", () => ({
  useAnnotationSampler: () => ({
    createStream: () => ({
      result: { value: null },
      isLoading: { value: false }
    })
  })
}));

/** A 0.07mm x 10mm single-shank contour. */
const SINGLE_SHANK_CONTOUR = [
  [-0.035, 0],
  [0.035, 0],
  [0.035, 10],
  [-0.035, 10]
];

// happy-dom's IntersectionObserver never invokes its callback, so replace it
// with a fake whose constructor records a trigger function per observed
// `q-intersection` root, giving each test explicit control over visibility.
let observerTriggers: Array<
  (entry: Partial<IntersectionObserverEntry>) => void
> = [];

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerTriggers.push(entry =>
      callback([entry as IntersectionObserverEntry], this as never)
    );
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/**
 * Fire the first registered `IntersectionObserver` callback with the given
 * intersection state. `rootBounds` must be non-null, or Quasar's directive
 * treats the entry as stale and re-observes instead of updating visibility.
 * @param isIntersecting Intersection state to report.
 */
async function triggerIntersection(isIntersecting: boolean): Promise<void> {
  observerTriggers[0]!({ isIntersecting, rootBounds: {} as DOMRectReadOnly });
  await nextTick();
}

describe("ChannelMaps", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    observerTriggers = [];
    vi.mocked(getManifest).mockResolvedValue(null);
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mountChannelMaps() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCurrentExperimentStore(pinia);

    const contouredDefinition = makeProbeInterfaceProbe({
      si_units: "mm",
      probe_planar_contour: SINGLE_SHANK_CONTOUR,
      annotations: { manufacturer: "cambridgeneurotech", model_name: "ASSY-1" }
    });
    internProbeInterfaceProbe(store.experiment, contouredDefinition);
    const contouredProbe = makeProbe({
      probeInterfaceIdentifier:
        getProbeInterfaceIdentifier(contouredDefinition),
      name: "Contoured probe"
    });

    const contourlessDefinition = makeProbeInterfaceProbe({
      annotations: { manufacturer: "cambridgeneurotech", model_name: "ASSY-2" }
    });
    internProbeInterfaceProbe(store.experiment, contourlessDefinition);
    const contourlessProbe = makeProbe({
      probeInterfaceIdentifier: getProbeInterfaceIdentifier(
        contourlessDefinition
      ),
      name: "Contourless probe"
    });

    store.experiment.probes = [contouredProbe, contourlessProbe];

    const wrapper = mountWithQuasar(ChannelMaps, { pinia });
    return { wrapper, store };
  }

  it("renders one viewport for the contoured probe at the default (large) zoom height and aspect ratio", () => {
    const { wrapper } = mountChannelMaps();

    const viewports = wrapper.findAll(".channel-maps__viewport");
    expect(viewports).toHaveLength(1);
    const style = viewports[0]!.attributes("style")!;
    expect(style).toContain("height: 80vh");
    expect(style).toContain("aspect-ratio: 0.007");
  });

  it("resizes the viewport when the zoom toggle changes", async () => {
    const { wrapper } = mountChannelMaps();

    const smallButton = wrapper
      .findAllComponents({ name: "QBtn" })
      .find(btn => btn.text() === "Small")!;
    await smallButton.trigger("click");

    expect(
      wrapper.find(".channel-maps__viewport").attributes("style")
    ).toContain("height: 20vh");

    const mediumButton = wrapper
      .findAllComponents({ name: "QBtn" })
      .find(btn => btn.text() === "Medium")!;
    await mediumButton.trigger("click");

    expect(
      wrapper.find(".channel-maps__viewport").attributes("style")
    ).toContain("height: 50vh");
  });

  it("shows the no-contour message and no viewport for a probe without a usable contour", () => {
    const { wrapper } = mountChannelMaps();

    const cards = wrapper.findAllComponents({ name: "QCard" });
    const contourlessCard = cards.find(card =>
      card.text().includes("Contourless probe")
    )!;

    expect(contourlessCard.find(".channel-maps__viewport").exists()).toBe(
      false
    );
    expect(contourlessCard.text()).toContain(
      "This probe has no contour to slice through."
    );
  });

  it("mounts the canvas only while its card is intersecting the viewport", async () => {
    const { wrapper } = mountChannelMaps();

    expect(wrapper.findComponent(ChannelMapCanvas).exists()).toBe(false);

    await triggerIntersection(true);
    expect(wrapper.findComponent(ChannelMapCanvas).exists()).toBe(true);

    await triggerIntersection(false);
    expect(wrapper.findComponent(ChannelMapCanvas).exists()).toBe(false);
  });
});
