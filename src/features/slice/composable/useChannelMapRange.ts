import { computed, type Ref, type WritableComputedRef } from "vue";
import type { Probe, ProbeContour } from "@/features/probe";
import {
  clampChannelMapRange,
  type ChannelMapRange
} from "../api/channel-map.api";

/** A probe's persisted channel map depth range, clamped to the current contour. */
export interface ChannelMapRangeViewport {
  range: WritableComputedRef<ChannelMapRange>;
}

/**
 * Track a probe's channel map depth range, clamping it into the current
 * contour's tip-to-top height and writing changes back to the probe. Reads
 * `probe` on every access rather than taking a plain value, so switching to
 * a different probe object picks up its own persisted range.
 * @param probe Probe to read and write the persisted range on.
 * @param contour Probe's contour, or null when unavailable.
 */
export function useChannelMapRange(
  probe: Ref<Probe>,
  contour: Ref<ProbeContour | null>
): ChannelMapRangeViewport {
  const range = computed<ChannelMapRange>({
    get: () => {
      const raw = {
        startMillimeters: probe.value.channelMapRangeStartMillimeters,
        endMillimeters:
          probe.value.channelMapRangeEndMillimeters ??
          contour.value?.heightMillimeters ??
          probe.value.channelMapRangeStartMillimeters
      };
      return contour.value ? clampChannelMapRange(raw, contour.value) : raw;
    },
    set: value => {
      probe.value.channelMapRangeStartMillimeters = value.startMillimeters;
      probe.value.channelMapRangeEndMillimeters = value.endMillimeters;
    }
  });

  return { range };
}
