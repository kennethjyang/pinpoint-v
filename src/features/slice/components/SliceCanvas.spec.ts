import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowRef } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import SliceCanvas from "./SliceCanvas.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import {
  makeManifest,
  makeProbe,
  makeProbeInterfaceProbe,
  makeTerminologyRow
} from "@/test/fixtures";
import { getManifest, getTerminologyRows } from "@/features/atlas";
import { internProbeInterfaceProbe } from "@/features/experiment";
import { getProbeInterfaceIdentifier } from "@/features/probe";
import type { SampleResult } from "../models/sample-result.model";
import { SLICE_EXTENTS_MILLIMETERS } from "../api/slice-plane.api";

// Mirrors ProbeInspector.spec.ts: manifest/terminologyRows are computedAsync
// and fetch on store creation, so the leaf module must be mocked or mounting
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

// SliceCanvas owns its sampler internally rather than taking it as a prop,
// so the composable module itself is mocked to hand the spec direct control
// over `result`/`isLoading`, without a real worker or zarr fetch.
const mockResult = shallowRef<SampleResult | null>(null);
const mockIsLoading = shallowRef(false);
vi.mock("../composable/useAnnotationSampler", () => ({
  useAnnotationSampler: () => ({
    createStream: () => ({ result: mockResult, isLoading: mockIsLoading })
  })
}));

/** A 10mm-square contour with a single contact 2mm above the tip. */
const CONTOUR = [
  [-5, 0],
  [5, 0],
  [5, 10],
  [-5, 10]
];

function makeSampleResult(
  sizePixels: number,
  annotationValues: number[]
): SampleResult {
  return {
    sampleCount: sizePixels * sizePixels,
    annotationValues: Uint32Array.from(annotationValues),
    pixels: new Uint8ClampedArray(sizePixels * sizePixels * 4),
    paintedChunkCount: 1,
    totalChunkCount: 1
  };
}

describe("SliceCanvas", () => {
  beforeEach(() => {
    vi.mocked(getManifest).mockResolvedValue(makeManifest());
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
    mockResult.value = null;
    mockIsLoading.value = false;
  });

  function mountSlice() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCurrentExperimentStore(pinia);

    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      probe_planar_contour: CONTOUR,
      contact_positions: [[0, 2]]
    });
    internProbeInterfaceProbe(store.experiment, probeInterfaceProbe);
    const probe = makeProbe({
      probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe)
    });
    store.experiment.probes = [probe];

    const wrapper = mountWithQuasar(SliceCanvas, { pinia, props: { probe } });
    return { wrapper, store, probe };
  }

  it("shows the no-contacts message when the probe has no usable contacts", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCurrentExperimentStore(pinia);
    const probeInterfaceProbe = makeProbeInterfaceProbe({
      contact_positions: []
    });
    internProbeInterfaceProbe(store.experiment, probeInterfaceProbe);
    const probe = makeProbe({
      probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe)
    });
    store.experiment.probes = [probe];

    const wrapper = mountWithQuasar(SliceCanvas, { pinia, props: { probe } });

    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("draws the contour overlay re-origined on the contact center, flipping y for SVG", () => {
    const { wrapper } = mountSlice();

    // Contour is centered at x=0 already; contact sits at local y=0 (2mm
    // above the tip, same as the contour's local origin after
    // getProbeContacts re-origins on the contour). The polygon's points must
    // negate y (SVG down is +y) relative to the contact center.
    const polygon = wrapper.find("polygon");
    expect(polygon.exists()).toBe(true);
    const points = polygon.attributes("points");
    expect(points).toBeTruthy();

    // Every declared contour point's x must appear unchanged (contacts are
    // laterally centered on the contour), and the y coordinates must be the
    // negation of (contourY - contactY).
    const parsed = points!
      .trim()
      .split(" ")
      .map(pair => pair.split(",").map(Number));
    expect(parsed).toEqual([
      [-5, 2],
      [5, 2],
      [5, -8],
      [-5, -8]
    ]);
  });

  it("disables zoom-in at the smallest extent and zoom-out at the largest", async () => {
    const { wrapper, store } = mountSlice();
    store.sliceExtentIndex = 0;
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAllComponents({ name: "QBtn" });
    const zoomIn = buttons.find(b => b.props("icon") === "remove")!;
    const zoomOut = buttons.find(b => b.props("icon") === "add")!;
    expect(zoomIn.props("disable")).toBe(true);
    expect(zoomOut.props("disable")).toBe(false);

    store.sliceExtentIndex = SLICE_EXTENTS_MILLIMETERS.length - 1;
    await wrapper.vm.$nextTick();
    expect(zoomOut.props("disable")).toBe(true);
  });

  it("clicking zoom out writes the next-larger index to the store", async () => {
    const { wrapper, store } = mountSlice();
    store.sliceExtentIndex = 2;
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAllComponents({ name: "QBtn" });
    await buttons.find(b => b.props("icon") === "add")!.trigger("click");

    expect(store.sliceExtentIndex).toBe(3);
  });

  it("clicking zoom in writes the next-smaller index to the store", async () => {
    const { wrapper, store } = mountSlice();
    store.sliceExtentIndex = 2;
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAllComponents({ name: "QBtn" });
    await buttons.find(b => b.props("icon") === "remove")!.trigger("click");

    expect(store.sliceExtentIndex).toBe(1);
  });

  it("shows a tooltip for the structure under a hovered pixel", async () => {
    mockResult.value = makeSampleResult(2, [0, 8, 0, 0]);
    const rows = [makeTerminologyRow({ annotation_value: 8, identifier: 8 })];
    vi.mocked(getTerminologyRows).mockResolvedValue(rows);
    const { wrapper } = mountSlice();
    await flushPromises();

    const canvas = wrapper.find("canvas");
    vi.spyOn(canvas.element, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    // Pixel (1, 0) of a 2x2 result maps to the top-right quadrant of a
    // 100x100 element, i.e. clientX/Y around (75, 25). QTooltip only
    // attaches its mouseenter listener once mounted (`v-if="hoveredStructure"`)
    // and only renders portalled content once "showing" - so pointermove
    // must land first to mount it, then a mouseenter on its DOM parent (its
    // default anchor - the square container, not the canvas itself) to open
    // it, then a real (zero-delay) timer tick for its registerTimeout to fire.
    await canvas.trigger("pointermove", { clientX: 75, clientY: 25 });
    await wrapper.find(".slice-canvas__square").trigger("mouseenter");
    await new Promise(resolve => setTimeout(resolve, 0));
    await flushPromises();

    // QTooltip teleports its shown content to a global node appended
    // directly to document.body, outside the wrapper's own mounted
    // subtree, so it must be queried there rather than through `wrapper`.
    expect(document.body.querySelector(".q-tooltip")?.textContent).toContain(
      rows[0]!.abbreviation
    );
  });

  it("shows no tooltip over a background pixel", async () => {
    mockResult.value = makeSampleResult(2, [0, 0, 0, 0]);
    const { wrapper } = mountSlice();
    await wrapper.vm.$nextTick();

    const canvas = wrapper.find("canvas");
    vi.spyOn(canvas.element, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    await canvas.trigger("pointermove", { clientX: 10, clientY: 10 });

    expect(wrapper.findComponent({ name: "QTooltip" }).exists()).toBe(false);
  });

  it("clears the hovered structure on pointer leave", async () => {
    mockResult.value = makeSampleResult(2, [0, 8, 0, 0]);
    const rows = [makeTerminologyRow({ annotation_value: 8, identifier: 8 })];
    vi.mocked(getTerminologyRows).mockResolvedValue(rows);
    const { wrapper } = mountSlice();
    await flushPromises();

    const canvas = wrapper.find("canvas");
    vi.spyOn(canvas.element, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    await canvas.trigger("pointermove", { clientX: 75, clientY: 25 });
    expect(wrapper.findComponent({ name: "QTooltip" }).exists()).toBe(true);

    await canvas.trigger("pointerleave");
    expect(wrapper.findComponent({ name: "QTooltip" }).exists()).toBe(false);
  });

  it("clicking a hovered structure toggles it into visibleStructures, and again removes it", async () => {
    mockResult.value = makeSampleResult(2, [0, 8, 0, 0]);
    const rows = [makeTerminologyRow({ annotation_value: 8, identifier: 8 })];
    vi.mocked(getTerminologyRows).mockResolvedValue(rows);
    const { wrapper, store } = mountSlice();
    await flushPromises();

    const canvas = wrapper.find("canvas");
    vi.spyOn(canvas.element, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    await canvas.trigger("pointermove", { clientX: 75, clientY: 25 });
    await canvas.trigger("click");
    expect(store.experiment.visibleStructures).toContain(8);

    await canvas.trigger("click");
    expect(store.experiment.visibleStructures).not.toContain(8);
  });

  it("a click over background is a no-op", async () => {
    mockResult.value = makeSampleResult(2, [0, 0, 0, 0]);
    const { wrapper, store } = mountSlice();
    await wrapper.vm.$nextTick();

    const canvas = wrapper.find("canvas");
    vi.spyOn(canvas.element, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });

    await canvas.trigger("pointermove", { clientX: 10, clientY: 10 });
    await canvas.trigger("click");

    expect(store.experiment.visibleStructures).toEqual([]);
  });

  it("shows a progress bar while loading", async () => {
    mockIsLoading.value = true;
    const { wrapper } = mountSlice();
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent({ name: "QLinearProgress" }).exists()).toBe(
      true
    );
  });
});
