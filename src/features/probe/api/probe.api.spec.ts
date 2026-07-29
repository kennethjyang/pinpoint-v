import { describe, it, expect } from "vitest";
import { reactive, isReactive, isProxy, toRaw } from "vue";
import {
  buildProbe,
  detachProbeInterfaceProbe,
  rotateProbeVisibility
} from "./probe.api";
import { makeExperimentProbe, makeProbe } from "@/test/fixtures";

describe("buildProbe", () => {
  it("references the given probe interface definition id", () => {
    const probe = buildProbe("spec-1");
    expect(probe.probeInterfaceProbeId).toBe("spec-1");
  });

  it("builds a probe with sensible defaults", () => {
    const probe = buildProbe("spec-1");

    expect(probe.inspectableKind).toBe("probe");
    expect(probe.visibility).toBe("visible");
    expect(probe.tipPosition).toEqual([0, 0, 0]);
    expect(probe.orientation).toEqual([0, 0, 0]);
    expect(probe.name).toMatch(/^Probe /);
    expect(probe.color).toMatch(/^#/);
  });

  it("gives each probe a unique name", () => {
    const a = buildProbe("spec-1");
    const b = buildProbe("spec-1");
    expect(a.name).not.toBe(b.name);
  });
});

describe("detachProbeInterfaceProbe", () => {
  it("returns a structurally equal copy", () => {
    const spec = makeProbe();
    const detached = detachProbeInterfaceProbe(spec);
    expect(detached).toEqual(spec);
  });

  it("returns an object independent of the source", () => {
    const spec = makeProbe();
    const detached = detachProbeInterfaceProbe(spec);

    expect(detached).not.toBe(spec);
    expect(detached.contact_positions).not.toBe(spec.contact_positions);

    // Mutating the source afterwards must not affect the detached copy, and
    // vice versa -- they must not share nested structure.
    spec.contact_positions.push([9, 9]);
    expect(detached.contact_positions).toEqual([[0, 0]]);
  });

  it("opts the returned object out of Vue's reactivity", () => {
    const detached = detachProbeInterfaceProbe(makeProbe());
    const holder = reactive({ spec: detached });

    expect(isReactive(holder.spec)).toBe(false);
  });

  it("accepts a reactive proxy without throwing, and does not mark the source raw", () => {
    const source = reactive(makeProbe());

    const detached = detachProbeInterfaceProbe(source);

    expect(detached).toEqual(toRaw(source));
    // The source (e.g. a probe library entry) must remain reactive: marking
    // it raw would be a side effect on shared state well beyond this call.
    expect(isReactive(source)).toBe(true);
    expect(isProxy(source)).toBe(true);
  });
});

describe("rotateProbeVisibility", () => {
  it("cycles visible -> shanks -> hidden -> visible", () => {
    const probe = makeExperimentProbe({ visibility: "visible" });

    rotateProbeVisibility(probe);
    expect(probe.visibility).toBe("shanks");

    rotateProbeVisibility(probe);
    expect(probe.visibility).toBe("hidden");

    rotateProbeVisibility(probe);
    expect(probe.visibility).toBe("visible");
  });
});
