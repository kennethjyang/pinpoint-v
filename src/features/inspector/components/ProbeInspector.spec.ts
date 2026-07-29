import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ProbeInspector from "./ProbeInspector.vue";
import { mountWithQuasar } from "@/test/mount-helper";
import { useCurrentExperimentStore } from "@/stores/current-experiment.store";
import { useProbeLibraryStore } from "@/stores/probe-library.store";
import { makeExperimentProbe, makeProbe } from "@/test/fixtures";
import { getManifest, getTerminologyRows } from "@/features/atlas";

// `useCurrentExperimentStore`'s `manifest`/`terminologyRows` are
// `computedAsync` and fetch on store creation -- mock the leaf module (not
// the `@/features/atlas` barrel) or mounting triggers real network calls.
// Mirrors the mocking approach in SceneHierarchy.spec.ts.
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

function fieldByLabel(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: "QInput" })
    .find(field => field.props("label") === label)!;
}

/**
 * Focus, replace a field's text, and blur it -- the sequence a real user
 * produces, which `use-field`'s handlers require in this order.
 */
async function editAndBlur(field: VueWrapper, value: string) {
  const native = field.find("input");
  await native.trigger("focusin");
  await native.setValue(value);
  await native.trigger("focusout");
  await new Promise(resolve => setTimeout(resolve));
}

async function editAndEnter(field: VueWrapper, value: string) {
  const native = field.find("input");
  await native.trigger("focusin");
  await native.setValue(value);
  await native.trigger("keyup", { key: "Enter" });
}

describe("ProbeInspector", () => {
  beforeEach(() => {
    vi.mocked(getManifest).mockResolvedValue(null);
    vi.mocked(getTerminologyRows).mockResolvedValue([]);
  });

  function mountInspector(probe = makeExperimentProbe()) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const probeLibrary = useProbeLibraryStore(pinia);
    probeLibrary.add(makeProbe());
    const store = useCurrentExperimentStore(pinia);
    store.experiment.probes = [probe];

    const wrapper = mountWithQuasar(ProbeInspector, {
      pinia,
      props: { probe: store.experiment.probes[0]! }
    });
    return { wrapper, store, probe: store.experiment.probes[0]! };
  }

  it("does not mutate the name while typing, before blur or enter", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ name: "A" })
    );

    const name = fieldByLabel(wrapper, "Name");
    await name.find("input").trigger("focusin");
    await name.find("input").setValue("B");

    expect(probe.name).toBe("A");
  });

  it("commits the name on blur when valid", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ name: "A" })
    );

    await editAndBlur(fieldByLabel(wrapper, "Name"), "B");

    expect(probe.name).toBe("B");
  });

  it("commits the name on Enter when valid", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ name: "A" })
    );

    await editAndEnter(fieldByLabel(wrapper, "Name"), "B");

    expect(probe.name).toBe("B");
  });

  it("rejects a whitespace-only name and leaves the probe's name unchanged", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ name: "A" })
    );

    const name = fieldByLabel(wrapper, "Name");
    await editAndBlur(name, "   ");

    expect(probe.name).toBe("A");
    expect(name.find("[role='alert']").text()).toBe("Name is required.");
  });

  it("rejects a name already used by another probe in the experiment", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useProbeLibraryStore(pinia).add(makeProbe());
    const store = useCurrentExperimentStore(pinia);
    store.experiment.probes = [
      makeExperimentProbe({ name: "A" }),
      makeExperimentProbe({ name: "B" })
    ];
    const wrapper = mountWithQuasar(ProbeInspector, {
      pinia,
      props: { probe: store.experiment.probes[0]! }
    });

    const name = fieldByLabel(wrapper, "Name");
    await editAndBlur(name, "B");

    expect(store.experiment.probes[0]!.name).toBe("A");
    expect(name.find("[role='alert']").text()).toBe(
      "Another probe already uses this name."
    );
  });

  it("trims whitespace when committing a name", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ name: "A" })
    );

    await editAndBlur(fieldByLabel(wrapper, "Name"), "  Renamed  ");

    expect(probe.name).toBe("Renamed");
  });

  it("accepts re-committing the probe's own unchanged name", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ name: "A" })
    );

    const name = fieldByLabel(wrapper, "Name");
    await editAndBlur(name, "A");

    expect(probe.name).toBe("A");
    expect(name.find("[role='alert']").exists()).toBe(false);
  });

  it("commits AP/DV/ML into tipPosition as real numbers", async () => {
    const { wrapper, probe } = mountInspector();

    await editAndBlur(fieldByLabel(wrapper, "AP"), "-2.5");
    await editAndBlur(fieldByLabel(wrapper, "DV"), "1");
    await editAndBlur(fieldByLabel(wrapper, "ML"), "0");

    expect(probe.tipPosition).toEqual([-2.5, 1, 0]);
    expect(probe.tipPosition.every(value => typeof value === "number")).toBe(
      true
    );
  });

  it("commits Roll/Yaw/Pitch into orientation as real numbers", async () => {
    const { wrapper, probe } = mountInspector();

    await editAndBlur(fieldByLabel(wrapper, "Roll"), "0.1");
    await editAndBlur(fieldByLabel(wrapper, "Yaw"), "0.2");
    await editAndBlur(fieldByLabel(wrapper, "Pitch"), "0.3");

    expect(probe.orientation).toEqual([0.1, 0.2, 0.3]);
  });

  it("rejects a non-numeric value in a numeric field", async () => {
    const { wrapper, probe } = mountInspector();

    const ap = fieldByLabel(wrapper, "AP");
    await editAndBlur(ap, "abc");

    expect(probe.tipPosition[0]).toBe(0);
    expect(ap.find("[role='alert']").text()).toBe("Must be a number.");
  });

  it("rejects an empty numeric field", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ tipPosition: [5, 0, 0] })
    );

    await editAndBlur(fieldByLabel(wrapper, "AP"), "");

    expect(probe.tipPosition[0]).toBe(5);
  });

  it("accepts zero in a numeric field", async () => {
    const { wrapper, probe } = mountInspector(
      makeExperimentProbe({ tipPosition: [5, 0, 0] })
    );

    await editAndBlur(fieldByLabel(wrapper, "AP"), "0");

    expect(probe.tipPosition[0]).toBe(0);
  });

  it("re-seeds every field when the probe prop changes", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useProbeLibraryStore(pinia).add(makeProbe());
    const store = useCurrentExperimentStore(pinia);
    const a = makeExperimentProbe({ name: "A", tipPosition: [1, 2, 3] });
    const b = makeExperimentProbe({ name: "B", tipPosition: [4, 5, 6] });
    store.experiment.probes = [a, b];
    const wrapper = mountWithQuasar(ProbeInspector, {
      pinia,
      props: { probe: a }
    });

    // Cast: `setProps`'s generic doesn't narrow to the SFC's declared props.
    await wrapper.setProps({ probe: b } as Record<string, unknown>);

    expect(fieldByLabel(wrapper, "Name").props("modelValue")).toBe("B");
    expect(fieldByLabel(wrapper, "AP").props("modelValue")).toBe("4");
  });

  it("keeps the renamed probe selected and in sync with the store", async () => {
    const { wrapper, store, probe } = mountInspector(
      makeExperimentProbe({ name: "A" })
    );
    store.selectedInspectable = probe;

    await editAndBlur(fieldByLabel(wrapper, "Name"), "B");

    expect(store.isInspectableSelected(probe)).toBe(true);
    expect(store.selectedInspectable?.name).toBe("B");
  });
});
