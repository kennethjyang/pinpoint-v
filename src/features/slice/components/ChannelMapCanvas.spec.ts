import { describe, expect, it, vi } from "vitest";
import { nextTick, ref, shallowRef } from "vue";
import { createPinia, setActivePinia } from "pinia";
import ChannelMapCanvas from "./ChannelMapCanvas.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { makeProbe, makeProbeInterfaceProbe } from "@/test/fixtures";
import { getManifest, getTerminologyRows } from "@/features/atlas";
import { getProbeContour } from "@/features/probe";
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

    const contour = getProbeContour(
      makeProbeInterfaceProbe({
        si_units: "mm",
        probe_planar_contour: SINGLE_SHANK_CONTOUR
      })
    )!;
    const probe = makeProbe({ tipPosition: [0, 0, 0], rotation: [0, 0, 0] });

    const wrapper = mountWithQuasar(ChannelMapCanvas, {
      pinia,
      props: { probe, contour }
    });
    return { wrapper, store, probe, contour };
  }

  it("hands the sampler a geometry covering the contour's full extent at the measured size", () => {
    const { store, probe, contour } = mountCanvas();
    const frame = getProbeFrame(probe, store.referenceCoordinate);

    expect(capturedGeometry).toEqual({
      centerMillimeters: toAtlasMillimeters(frame, 0, 5),
      rightMillimeters: frame.rightMillimeters,
      upMillimeters: frame.upMillimeters,
      halfWidthMillimeters: 0.035,
      halfHeightMillimeters: 5,
      widthPixels: 4,
      heightPixels: 576
    });
    expect(contour.widthMillimeters).toBeCloseTo(0.07);
  });

  it("sizes the canvas to a published non-square result", async () => {
    const { wrapper } = mountCanvas();

    mockResult.value = makeSampleResult(4, 576);
    await nextTick();

    const canvas = wrapper.find("canvas").element as HTMLCanvasElement;
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(576);
  });
});
