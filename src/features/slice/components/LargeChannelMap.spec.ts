import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import LargeChannelMap from "./LargeChannelMap.vue";
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

// happy-dom's ResizeObserver never reports a real size (offsetWidth/Height
// stay 0), which would otherwise zero out both the sample grid and the label
// layout's canvas height - override useElementSize with a fixed layout size.
vi.mock("@vueuse/core", async importOriginal => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useElementSize: () => ({ width: ref(120), height: ref(400) })
  };
});

// LargeChannelMap owns its sampler internally rather than taking it as a
// prop, so the composable module itself is mocked to hand the spec direct
// control over `result`/`isLoading`, without a real worker or zarr fetch.
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
  widthPixels: number,
  heightPixels: number,
  annotationValues: number[]
): SampleResult {
  return {
    widthPixels,
    heightPixels,
    annotationValues: Uint32Array.from(annotationValues),
    pixels: new Uint8ClampedArray(widthPixels * heightPixels * 4),
    paintedChunkCount: 1,
    totalChunkCount: 1
  };
}

describe("LargeChannelMap", () => {
  beforeEach(() => {
    vi.mocked(getManifest).mockResolvedValue(makeManifest());
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
    mockResult.value = null;
    mockIsLoading.value = false;
  });

  function mountChannelMap(
    probeOverrides: Parameters<typeof makeProbe>[0] = {}
  ) {
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
      probeInterfaceIdentifier:
        getProbeInterfaceIdentifier(probeInterfaceProbe),
      ...probeOverrides
    });
    store.experiment.probes = [probe];

    const wrapper = mountWithQuasar(LargeChannelMap, {
      pinia,
      props: { probe }
    });
    return { wrapper, store, probe };
  }

  it("shows the probe's name and colored dot", () => {
    const { wrapper } = mountChannelMap({
      name: "My Probe",
      color: "#ff0000"
    });

    expect(wrapper.text()).toContain("My Probe");
    const icon = wrapper.find(".large-channel-map__header .q-icon");
    expect(icon.attributes("style")).toContain("color: #ff0000");
  });

  it("shows the no-contour message when the probe has no usable contour", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCurrentExperimentStore(pinia);
    const probeInterfaceProbe = makeProbeInterfaceProbe();
    internProbeInterfaceProbe(store.experiment, probeInterfaceProbe);
    const probe = makeProbe({
      probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe)
    });
    store.experiment.probes = [probe];

    const wrapper = mountWithQuasar(LargeChannelMap, {
      pinia,
      props: { probe }
    });

    expect(wrapper.find(".large-channel-map__overlay").exists()).toBe(false);
    expect(wrapper.findComponent({ name: "QRange" }).exists()).toBe(false);
    expect(wrapper.text()).toContain("no contour");
  });

  it("draws the contour overlay re-origined on the range's midpoint", () => {
    const { wrapper } = mountChannelMap({
      channelMapRangeStartMillimeters: 0,
      channelMapRangeEndMillimeters: 4
    });

    const polygon = wrapper.find("polygon");
    expect(polygon.exists()).toBe(true);
    const points = polygon.attributes("points");
    expect(points).toBeTruthy();

    // Midpoint of [0, 4] is 2, so the contour's tip (y=0) re-origins to 2.
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

  it("reads the range slider from the probe's saved range, clamped to the contour", () => {
    const { wrapper } = mountChannelMap({
      channelMapRangeStartMillimeters: -5,
      channelMapRangeEndMillimeters: 999
    });

    const range = wrapper.findComponent({ name: "QRange" });
    expect(range.props("modelValue")).toEqual({ min: 0, max: 10 });
  });

  it("moving the range slider writes both ends to the probe", async () => {
    const { wrapper, probe } = mountChannelMap({
      channelMapRangeStartMillimeters: 0,
      channelMapRangeEndMillimeters: 10
    });

    const range = wrapper.findComponent({ name: "QRange" });
    await range.vm.$emit("update:modelValue", { min: 2, max: 6 });

    expect(probe.channelMapRangeStartMillimeters).toBe(2);
    expect(probe.channelMapRangeEndMillimeters).toBe(6);
  });

  it("draws a contact within the visible range as an SVG shape", () => {
    const { wrapper } = mountChannelMap({
      channelMapRangeStartMillimeters: 0,
      channelMapRangeEndMillimeters: 10
    });

    // The fixture contact is a square (default shape), so it renders as <rect>.
    expect(wrapper.find(".large-channel-map__contact").exists()).toBe(true);
  });

  it("omits a contact outside the visible range", () => {
    const { wrapper } = mountChannelMap({
      channelMapRangeStartMillimeters: 0,
      // Contact sits at y=2; a range ending at 1mm excludes it.
      channelMapRangeEndMillimeters: 1
    });

    expect(wrapper.find(".large-channel-map__contact").exists()).toBe(false);
  });

  it("shows a tooltip for the structure under a hovered pixel", async () => {
    mockResult.value = makeSampleResult(2, 2, [0, 8, 0, 0]);
    const rows = [makeTerminologyRow({ annotation_value: 8, identifier: 8 })];
    vi.mocked(getTerminologyRows).mockResolvedValue(rows);
    const { wrapper } = mountChannelMap();
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
    await wrapper.find(".large-channel-map__canvas-area").trigger("mouseenter");
    await new Promise(resolve => setTimeout(resolve, 0));
    await flushPromises();

    expect(document.body.querySelector(".q-tooltip")?.textContent).toContain(
      rows[0]!.abbreviation
    );
  });

  it("shows no tooltip over a background pixel", async () => {
    mockResult.value = makeSampleResult(2, 2, [0, 0, 0, 0]);
    const { wrapper } = mountChannelMap();
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
    mockResult.value = makeSampleResult(2, 2, [0, 8, 0, 0]);
    const rows = [makeTerminologyRow({ annotation_value: 8, identifier: 8 })];
    vi.mocked(getTerminologyRows).mockResolvedValue(rows);
    const { wrapper } = mountChannelMap();
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

  it("shows a progress bar only once loading has run past the debounce delay", async () => {
    vi.useFakeTimers();
    try {
      mockIsLoading.value = true;
      const { wrapper } = mountChannelMap();
      await wrapper.vm.$nextTick();

      expect(wrapper.findComponent({ name: "QLinearProgress" }).exists()).toBe(
        false
      );

      vi.advanceTimersByTime(500);
      await wrapper.vm.$nextTick();

      expect(wrapper.findComponent({ name: "QLinearProgress" }).exists()).toBe(
        true
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows region abbreviation labels from the sampled result", async () => {
    mockResult.value = makeSampleResult(1, 4, [8, 8, 8, 8]);
    const rows = [
      makeTerminologyRow({
        annotation_value: 8,
        identifier: 8,
        abbreviation: "grey"
      })
    ];
    vi.mocked(getTerminologyRows).mockResolvedValue(rows);
    const { wrapper } = mountChannelMap({
      channelMapRangeStartMillimeters: 0,
      channelMapRangeEndMillimeters: 4
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".large-channel-map__label").text()).toBe("grey");
  });
});
