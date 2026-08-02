import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";
import { createPinia, setActivePinia } from "pinia";
import ChannelMaps from "./ChannelMaps.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import {
  makeManifest,
  makeProbe,
  makeProbeInterfaceProbe
} from "@/test/fixtures";
import { getManifest, getTerminologyRows } from "@/features/atlas";
import { internProbeInterfaceProbe } from "@/features/experiment";
import { getProbeInterfaceIdentifier } from "@/features/probe";
import type { SampleResult } from "../models/sample-result.model";

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

vi.mock("../composable/useAnnotationSampler", () => ({
  useAnnotationSampler: () => ({
    createStream: () => ({
      result: shallowRef<SampleResult | null>(null),
      isLoading: shallowRef(false)
    })
  })
}));

vi.mock("@vueuse/core", async importOriginal => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useElementSize: () => ({ width: ref(120), height: ref(400) })
  };
});

describe("ChannelMaps", () => {
  beforeEach(() => {
    vi.mocked(getManifest).mockResolvedValue(makeManifest());
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
  });

  it("shows the empty-state hint when no probes are present", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mountWithQuasar(ChannelMaps, { pinia });

    expect(wrapper.text()).toContain("Add a probe");
    expect(wrapper.findComponent({ name: "LargeChannelMap" }).exists()).toBe(
      false
    );
  });

  it("renders one panel per probe, regardless of selection", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCurrentExperimentStore(pinia);

    const probeInterfaceProbe = makeProbeInterfaceProbe();
    internProbeInterfaceProbe(store.experiment, probeInterfaceProbe);
    const probeA = makeProbe({
      name: "Probe A",
      probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe)
    });
    const probeB = makeProbe({
      name: "Probe B",
      probeInterfaceIdentifier: getProbeInterfaceIdentifier(probeInterfaceProbe)
    });
    store.experiment.probes = [probeA, probeB];
    // No selection - the requirement is that panels render regardless.
    store.selectedInspectable = null;

    const wrapper = mountWithQuasar(ChannelMaps, { pinia });

    const panels = wrapper.findAllComponents({ name: "LargeChannelMap" });
    expect(panels).toHaveLength(2);
    expect(wrapper.text()).toContain("Probe A");
    expect(wrapper.text()).toContain("Probe B");
  });
});
