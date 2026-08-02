import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { getProbeContour } from "@/features/probe";
import { makeProbe, makeProbeInterfaceProbe } from "@/test/fixtures";
import { useChannelMapRange } from "./useChannelMapRange";

const CONTOUR = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10]
];

function makeContour() {
  return getProbeContour(
    makeProbeInterfaceProbe({ si_units: "mm", probe_planar_contour: CONTOUR })
  )!;
}

describe("useChannelMapRange", () => {
  it("defaults the end to the contour's height when unset", () => {
    const probe = ref(
      makeProbe({
        channelMapRangeStartMillimeters: 0,
        channelMapRangeEndMillimeters: null
      })
    );
    const { range } = useChannelMapRange(probe, ref(makeContour()));

    expect(range.value).toEqual({ startMillimeters: 0, endMillimeters: 10 });
  });

  it("defaults the end to the start when there's no contour either", () => {
    const probe = ref(
      makeProbe({
        channelMapRangeStartMillimeters: 2,
        channelMapRangeEndMillimeters: null
      })
    );
    const { range } = useChannelMapRange(probe, ref(null));

    expect(range.value).toEqual({ startMillimeters: 2, endMillimeters: 2 });
  });

  it("clamps a persisted range outside the current contour's height", () => {
    const probe = ref(
      makeProbe({
        channelMapRangeStartMillimeters: -5,
        channelMapRangeEndMillimeters: 999
      })
    );
    const { range } = useChannelMapRange(probe, ref(makeContour()));

    expect(range.value).toEqual({ startMillimeters: 0, endMillimeters: 10 });
  });

  it("writes both ends back to the probe", () => {
    const probe = ref(
      makeProbe({
        channelMapRangeStartMillimeters: 0,
        channelMapRangeEndMillimeters: 10
      })
    );
    const { range } = useChannelMapRange(probe, ref(makeContour()));

    range.value = { startMillimeters: 2, endMillimeters: 6 };

    expect(probe.value.channelMapRangeStartMillimeters).toBe(2);
    expect(probe.value.channelMapRangeEndMillimeters).toBe(6);
  });

  it("picks up a different probe's own persisted range once probe changes", () => {
    const probe = ref(
      makeProbe({
        channelMapRangeStartMillimeters: 0,
        channelMapRangeEndMillimeters: 4
      })
    );
    const { range } = useChannelMapRange(probe, ref(makeContour()));

    probe.value = makeProbe({
      channelMapRangeStartMillimeters: 1,
      channelMapRangeEndMillimeters: 8
    });

    expect(range.value).toEqual({ startMillimeters: 1, endMillimeters: 8 });
  });
});
