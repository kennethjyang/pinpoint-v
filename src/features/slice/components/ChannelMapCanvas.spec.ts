import { describe, expect, it, vi } from "vitest";
import { nextTick, ref, shallowRef } from "vue";
import { createPinia, setActivePinia } from "pinia";
import ChannelMapCanvas from "./ChannelMapCanvas.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { makeProbe, makeProbeInterfaceProbe } from "@/test/fixtures";
import { getManifest, getTerminologyRows } from "@/features/atlas";
import { getProbeContour, getProbeShanks } from "@/features/probe";
import { getProbeFrame, toAtlasMillimeters } from "../api/probe-frame.api";
import type { SampleGeometry } from "../models/sample-geometry.model";
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

/** Geometry handed to `createStream` by the most recently mounted canvas. */
let capturedGeometry: SampleGeometry | null = null;
const mockResult = shallowRef<SampleResult | null>(null);
const mockIsLoading = shallowRef(false);
vi.mock("../composable/useAnnotationSampler", () => ({
  useAnnotationSampler: () => ({
    createStream: (geometry: { value: SampleGeometry | null }) => {
      capturedGeometry = geometry.value;
      return { result: mockResult, isLoading: mockIsLoading };
    }
  })
}));

// `useElementSize` measures a real layout, which happy-dom never performs,
// so it's replaced with a fixed height matching the plan's worked example
// (600px at pixelRatio 1 quantizes to 576 device pixels).
vi.mock("@vueuse/core", async importOriginal => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useElementSize: () => ({ width: ref(4), height: ref(600) })
  };
});

/** A 0.07mm x 10mm single-shank contour. */
const SINGLE_SHANK_CONTOUR = [
  [-0.035, 0],
  [0.035, 0],
  [0.035, 10],
  [-0.035, 10]
];

/** Two 0.1mm shanks 1.8mm apart, joined along a top edge at y = 10mm. */
const TWO_SHANK_CONTOUR = [
  [-1, 10],
  [-1, 0],
  [-0.9, 0],
  [-0.9, 10],
  [0.9, 10],
  [0.9, 0],
  [1, 0],
  [1, 10]
];

function makeSampleResult(
  widthPixels: number,
  heightPixels: number
): SampleResult {
  return {
    widthPixels,
    heightPixels,
    annotationValues: new Uint32Array(widthPixels * heightPixels),
    pixels: new Uint8ClampedArray(widthPixels * heightPixels * 4),
    paintedChunkCount: 1,
    totalChunkCount: 1
  };
}

describe("ChannelMapCanvas", () => {
  function mountCanvas() {
    vi.mocked(getManifest).mockResolvedValue(null);
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
    capturedGeometry = null;
    mockResult.value = null;
    mockIsLoading.value = false;

    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCurrentExperimentStore(pinia);

    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      probe_planar_contour: SINGLE_SHANK_CONTOUR,
      contact_positions: [
        [0, 1],
        [0, 2]
      ],
      contact_shapes: ["square", "square"],
      contact_shape_params: [{ width: 0.02 }, { width: 0.02 }]
    });
    const contour = getProbeContour(probeInterfaceProbe)!;
    const shanks = getProbeShanks(probeInterfaceProbe, contour);
    const probe = makeProbe({ tipPosition: [0, 0, 0], rotation: [0, 0, 0] });

    const wrapper = mountWithQuasar(ChannelMapCanvas, {
      pinia,
      props: { probe, shanks, heightMillimeters: contour.heightMillimeters }
    });
    return { wrapper, store, probe, shanks, contour };
  }

  it("hands the sampler a geometry covering every shank's full extent at the measured size", () => {
    const { store, probe, contour } = mountCanvas();
    const frame = getProbeFrame(probe, store.referenceCoordinate);

    expect(capturedGeometry).toEqual({
      rightMillimeters: frame.rightMillimeters,
      upMillimeters: frame.upMillimeters,
      halfHeightMillimeters: 5,
      widthPixels: 4,
      heightPixels: 576,
      bands: [
        {
          centerMillimeters: toAtlasMillimeters(frame, 0, 5),
          // Derived from columnCount / (2 * pixelsPerMillimeter) = 4 / 115.2,
          // not the shank's true 0.035mm half-width - see getShankLayout.
          halfWidthMillimeters: 4 / 115.2,
          columnOffset: 0,
          columnCount: 4
        }
      ]
    });
    expect(contour.widthMillimeters).toBeCloseTo(0.07);
  });

  it("renders exactly one canvas", () => {
    const { wrapper } = mountCanvas();

    expect(wrapper.findAll("canvas")).toHaveLength(1);
  });

  it("sizes the canvas to a published non-square result", async () => {
    const { wrapper } = mountCanvas();

    mockResult.value = makeSampleResult(4, 576);
    await nextTick();

    const canvas = wrapper.find("canvas").element as HTMLCanvasElement;
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(576);
  });

  it("draws the shank outline and contact overlay", () => {
    const { wrapper } = mountCanvas();

    const svg = wrapper.find(".channel-map-canvas__overlay");
    // viewBox width is widthPixels / pixelsPerMillimeter = 4 / 57.6, the
    // packed layout's scale - not the shank's true 0.07mm width.
    expect(svg.attributes("viewBox")).toBe(`0 -5 ${4 / 57.6} 10`);

    const outline = wrapper.find(".channel-map-canvas__contour");
    expect(outline.attributes("d")).toBe(
      "M-0.035,5L0.035,5L0.035,-5L-0.035,-5Z"
    );

    const contacts = wrapper.find(".channel-map-canvas__contacts");
    expect(contacts.exists()).toBe(true);
    const d = contacts.attributes("d")!;
    expect(d.startsWith("M")).toBe(true);
    expect(d.match(/Z/g)).toHaveLength(2);
  });

  it("renders the outline with no contact path for a contour-only shank", () => {
    vi.mocked(getManifest).mockResolvedValue(null);
    vi.mocked(getTerminologyRows).mockResolvedValue([]);

    const pinia = createPinia();
    setActivePinia(pinia);

    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      probe_planar_contour: SINGLE_SHANK_CONTOUR,
      contact_positions: []
    });
    const contour = getProbeContour(probeInterfaceProbe)!;
    const shanks = getProbeShanks(probeInterfaceProbe, contour);
    const probe = makeProbe({ tipPosition: [0, 0, 0], rotation: [0, 0, 0] });

    const wrapper = mountWithQuasar(ChannelMapCanvas, {
      pinia,
      props: { probe, shanks, heightMillimeters: contour.heightMillimeters }
    });

    expect(wrapper.find(".channel-map-canvas__contour").exists()).toBe(true);
    expect(wrapper.find(".channel-map-canvas__contacts").exists()).toBe(false);
  });

  it("packs a two-shank probe into one canvas with two bands and two overlay groups", () => {
    vi.mocked(getManifest).mockResolvedValue(null);
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
    capturedGeometry = null;

    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCurrentExperimentStore(pinia);

    const probeInterfaceProbe = makeProbeInterfaceProbe({
      si_units: "mm",
      probe_planar_contour: TWO_SHANK_CONTOUR,
      contact_positions: [
        [-0.95, 1],
        [0.95, 1]
      ],
      shank_ids: ["0", "1"],
      contact_shapes: ["square", "square"],
      contact_shape_params: [{ width: 0.02 }, { width: 0.02 }]
    });
    const contour = getProbeContour(probeInterfaceProbe)!;
    const shanks = getProbeShanks(probeInterfaceProbe, contour);
    const probe = makeProbe({ tipPosition: [0, 0, 0], rotation: [0, 0, 0] });

    const wrapper = mountWithQuasar(ChannelMapCanvas, {
      pinia,
      props: { probe, shanks, heightMillimeters: contour.heightMillimeters }
    });

    expect(wrapper.findAll("canvas")).toHaveLength(1);

    expect(capturedGeometry).not.toBeNull();
    expect(capturedGeometry!.widthPixels).toBe(12);
    expect(capturedGeometry!.heightPixels).toBe(576);
    expect(capturedGeometry!.bands).toHaveLength(2);
    expect(capturedGeometry!.bands.map(band => band.columnOffset)).toEqual([
      0, 6
    ]);
    expect(capturedGeometry!.bands.map(band => band.columnCount)).toEqual([
      6, 6
    ]);

    const frame = getProbeFrame(probe, store.referenceCoordinate);
    expect(capturedGeometry!.bands[0]!.centerMillimeters).toEqual(
      toAtlasMillimeters(frame, -0.95, 5)
    );
    expect(capturedGeometry!.bands[1]!.centerMillimeters).toEqual(
      toAtlasMillimeters(frame, 0.95, 5)
    );

    const groups = wrapper.findAll(".channel-map-canvas__overlay > g");
    expect(groups).toHaveLength(2);
    expect(groups[1]!.attributes("transform")).toContain("translate(");
    const secondTranslateX = Number(
      groups[1]!.attributes("transform")!.match(/translate\(([^ ]+) /)![1]
    );
    expect(secondTranslateX).toBeCloseTo(-0.795833, 5);

    const canvas = wrapper.find("canvas");
    expect(canvas.attributes("aria-label")).toBe(
      `In-plane slice for ${probe.name}`
    );
  });
});
