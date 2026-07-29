import { describe, it, expect } from "vitest";
import { isReactive } from "vue";
import {
  addProbe,
  buildExperiment,
  clearVisibleStructures,
  getInternedProbeInterfaceProbe,
  internProbeInterfaceProbe,
  isStructureVisible,
  removeInternProbeInterfaceProbe,
  removeProbe,
  setStructureVisibility
} from "./experiment.api";
import { buildProbe, getProbeIdentifier } from "@/features/probe";
import { makeAtlas, makeExperimentProbe, makeProbe } from "@/test/fixtures";

describe("buildExperiment", () => {
  it("returns a new experiment with the given name, atlas, and reference coordinate", () => {
    const atlas = makeAtlas({ name: "allen_human" });

    const experiment = buildExperiment("New Experiment", atlas, [1, 2, 3]);

    expect(experiment.name).toBe("New Experiment");
    expect(experiment.atlas).toEqual(atlas);
    expect(experiment.referenceCoordinate).toEqual([1, 2, 3]);
    expect(experiment.visibleStructures).toEqual([]);
    expect(experiment.probeInterfaceProbes).toEqual({});
    expect(experiment.probes).toEqual([]);
  });
});

describe("isStructureVisible", () => {
  it("returns true when the identifier is in visibleStructures", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    experiment.visibleStructures = [5];

    expect(isStructureVisible(experiment, 5)).toBe(true);
  });

  it("returns false when the identifier is not in visibleStructures", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);

    expect(isStructureVisible(experiment, 5)).toBe(false);
  });
});

describe("setStructureVisibility", () => {
  it("adds the identifier when setting visible and not already present", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);

    setStructureVisibility(experiment, 5, true);

    expect(experiment.visibleStructures).toEqual([5]);
  });

  it("does not duplicate the identifier when already visible", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    experiment.visibleStructures = [5];

    setStructureVisibility(experiment, 5, true);

    expect(experiment.visibleStructures).toEqual([5]);
  });

  it("removes the identifier when setting invisible and present", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    experiment.visibleStructures = [5, 6];

    setStructureVisibility(experiment, 5, false);

    expect(experiment.visibleStructures).toEqual([6]);
  });

  it("is a no-op when setting invisible and not present", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    experiment.visibleStructures = [6];

    setStructureVisibility(experiment, 5, false);

    expect(experiment.visibleStructures).toEqual([6]);
  });
});

describe("clearVisibleStructures", () => {
  it("resets visibleStructures to []", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    experiment.visibleStructures = [1, 2, 3];

    clearVisibleStructures(experiment);

    expect(experiment.visibleStructures).toEqual([]);
  });
});

describe("internProbeInterfaceProbe", () => {
  it("stores the definition under the probe's identifier", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe();

    internProbeInterfaceProbe(experiment, spec);

    expect(experiment.probeInterfaceProbes).toEqual({
      "cambridgeneurotech ASSY-1": spec
    });
  });

  it("does not replace the existing entry when the same definition is interned twice", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = getProbeIdentifier(makeProbe());

    internProbeInterfaceProbe(experiment, makeProbe());
    const first = experiment.probeInterfaceProbes[identifier];
    internProbeInterfaceProbe(experiment, makeProbe());

    expect(experiment.probeInterfaceProbes[identifier]).toBe(first);
    expect(Object.keys(experiment.probeInterfaceProbes)).toHaveLength(1);
  });

  it("keeps definitions with different identifiers separate", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);

    internProbeInterfaceProbe(
      experiment,
      makeProbe({ annotations: { manufacturer: "imec", model_name: "np1" } })
    );
    internProbeInterfaceProbe(experiment, makeProbe());

    expect(Object.keys(experiment.probeInterfaceProbes)).toEqual([
      "imec np1",
      "cambridgeneurotech ASSY-1"
    ]);
  });

  it("keeps the first definition when another shares its identifier", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = getProbeIdentifier(makeProbe());

    internProbeInterfaceProbe(experiment, makeProbe({ si_units: "um" }));
    internProbeInterfaceProbe(experiment, makeProbe({ si_units: "mm" }));

    expect(Object.keys(experiment.probeInterfaceProbes)).toHaveLength(1);
    expect(experiment.probeInterfaceProbes[identifier]!.si_units).toBe("um");
  });

  it("detaches the interned definition from Vue's reactivity", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe();

    internProbeInterfaceProbe(experiment, spec);
    const interned = experiment.probeInterfaceProbes[getProbeIdentifier(spec)];

    expect(interned).toEqual(spec);
    expect(isReactive(interned)).toBe(false);
  });

  it("does not reflect later mutations of the source definition", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe();

    internProbeInterfaceProbe(experiment, spec);
    spec.contact_positions.push([9, 9]);

    expect(
      experiment.probeInterfaceProbes[getProbeIdentifier(spec)]!
        .contact_positions
    ).toEqual([[0, 0]]);
  });
});

describe("removeInternProbeInterfaceProbe", () => {
  it("removes the definition when no probe references it", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe();
    internProbeInterfaceProbe(experiment, spec);

    removeInternProbeInterfaceProbe(experiment, getProbeIdentifier(spec));

    expect(experiment.probeInterfaceProbes).toEqual({});
  });

  it("keeps the definition while a probe still references it", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe();
    internProbeInterfaceProbe(experiment, spec);
    const probe = makeExperimentProbe();
    addProbe(experiment, probe);

    removeInternProbeInterfaceProbe(experiment, probe.probeIdentifier);

    expect(getInternedProbeInterfaceProbe(experiment, probe)).toEqual(spec);
  });

  it("is a no-op when the identifier isn't interned", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    internProbeInterfaceProbe(experiment, makeProbe());

    removeInternProbeInterfaceProbe(experiment, "imec np1");

    expect(Object.keys(experiment.probeInterfaceProbes)).toEqual([
      "cambridgeneurotech ASSY-1"
    ]);
  });

  it("leaves other interned definitions in place", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const imec = makeProbe({
      annotations: { manufacturer: "imec", model_name: "np1" }
    });
    internProbeInterfaceProbe(experiment, makeProbe());
    internProbeInterfaceProbe(experiment, imec);

    removeInternProbeInterfaceProbe(experiment, getProbeIdentifier(imec));

    expect(Object.keys(experiment.probeInterfaceProbes)).toEqual([
      "cambridgeneurotech ASSY-1"
    ]);
  });

  it("drops the previous definition when a probe switches to another one", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const oldSpec = makeProbe();
    const newSpec = makeProbe({
      annotations: { manufacturer: "imec", model_name: "np1" }
    });
    internProbeInterfaceProbe(experiment, oldSpec);
    const probe = makeExperimentProbe();
    addProbe(experiment, probe);

    // Mirrors ProbeInspector's identifier-swap order: intern the new
    // definition, repoint the probe, then collect the old one.
    internProbeInterfaceProbe(experiment, newSpec);
    probe.probeIdentifier = getProbeIdentifier(newSpec);
    removeInternProbeInterfaceProbe(experiment, getProbeIdentifier(oldSpec));

    expect(experiment.probeInterfaceProbes).toEqual({ "imec np1": newSpec });
    expect(getInternedProbeInterfaceProbe(experiment, probe)).toEqual(newSpec);
  });
});

describe("getInternedProbeInterfaceProbe", () => {
  it("resolves a probe's interned definition", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe({ si_units: "mm" });
    internProbeInterfaceProbe(experiment, spec);
    const probe = buildProbe(spec);

    expect(getInternedProbeInterfaceProbe(experiment, probe)).toEqual(spec);
  });

  it("returns null when the probe's definition isn't in the experiment", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const probe = makeExperimentProbe({ probeIdentifier: "missing probe" });

    expect(getInternedProbeInterfaceProbe(experiment, probe)).toBeNull();
  });
});

describe("addProbe", () => {
  it("adds the probe to the experiment", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe();

    addProbe(experiment, probe);

    expect(experiment.probes).toEqual([probe]);
  });

  it("does nothing when a probe with the same name already exists", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe({ name: "dup" });
    addProbe(experiment, probe);

    addProbe(experiment, { ...probe, color: "#000000" });

    expect(experiment.probes).toHaveLength(1);
    expect(experiment.probes[0]!.color).toBe(probe.color);
  });
});

describe("removeProbe", () => {
  it("removes the probe from the experiment", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe();
    addProbe(experiment, probe);

    removeProbe(experiment, probe);

    expect(experiment.probes).toEqual([]);
  });

  it("is a no-op when the probe isn't in the experiment", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    internProbeInterfaceProbe(experiment, makeProbe());
    const kept = makeExperimentProbe({ name: "kept" });
    addProbe(experiment, kept);

    removeProbe(experiment, makeExperimentProbe({ name: "never-added" }));

    expect(experiment.probes).toEqual([kept]);
  });

  it("drops the probe's definition once no probe references it anymore", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe();
    addProbe(experiment, probe);

    removeProbe(experiment, probe);

    expect(experiment.probeInterfaceProbes).toEqual({});
  });
});
