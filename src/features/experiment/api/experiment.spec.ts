import { describe, it, expect } from "vitest";
import { isReactive } from "vue";
import {
  addProbe,
  buildExperiment,
  clearVisibleStructures,
  getInternedProbeInterfaceProbe,
  internProbeInterfaceProbe,
  isProbeNameAvailable,
  isStructureVisible,
  removeProbe,
  setStructureVisibility
} from "./experiment.api";
import { buildProbe } from "@/features/probe";
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
  it("stores a new definition and returns its identifier", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe();

    const identifier = internProbeInterfaceProbe(experiment, spec);

    expect(identifier).toBe("cambridgeneurotech ASSY-1");
    expect(experiment.probeInterfaceProbes).toEqual({
      "cambridgeneurotech ASSY-1": spec
    });
  });

  it("returns the existing identifier when the definition is already interned", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);

    const firstIdentifier = internProbeInterfaceProbe(experiment, makeProbe());
    const secondIdentifier = internProbeInterfaceProbe(experiment, makeProbe());

    expect(secondIdentifier).toBe(firstIdentifier);
    expect(Object.keys(experiment.probeInterfaceProbes)).toHaveLength(1);
  });

  it("keeps definitions with different identifiers separate", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);

    const npIdentifier = internProbeInterfaceProbe(
      experiment,
      makeProbe({ annotations: { manufacturer: "imec", model_name: "np1" } })
    );
    const cnIdentifier = internProbeInterfaceProbe(experiment, makeProbe());

    expect(npIdentifier).not.toBe(cnIdentifier);
    expect(Object.keys(experiment.probeInterfaceProbes)).toHaveLength(2);
  });

  it("keeps the first definition when another shares its identifier", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);

    const identifier = internProbeInterfaceProbe(
      experiment,
      makeProbe({ si_units: "um" })
    );
    internProbeInterfaceProbe(experiment, makeProbe({ si_units: "mm" }));

    expect(Object.keys(experiment.probeInterfaceProbes)).toHaveLength(1);
    expect(experiment.probeInterfaceProbes[identifier]!.si_units).toBe("um");
  });

  it("detaches the interned definition from Vue's reactivity", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = internProbeInterfaceProbe(experiment, makeProbe());

    expect(isReactive(experiment.probeInterfaceProbes[identifier])).toBe(false);
  });

  it("does not mutate or reactively couple to the source object", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const spec = makeProbe();

    const identifier = internProbeInterfaceProbe(experiment, spec);
    spec.contact_positions.push([9, 9]);

    expect(
      experiment.probeInterfaceProbes[identifier]!.contact_positions
    ).toEqual([[0, 0]]);
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
    const identifier = internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe({ probeIdentifier: identifier });

    addProbe(experiment, probe);

    expect(experiment.probes).toEqual([probe]);
  });

  it("does nothing when a probe with the same name already exists", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe({
      name: "dup",
      probeIdentifier: identifier
    });
    addProbe(experiment, probe);

    addProbe(experiment, { ...probe, color: "#000000" });

    expect(experiment.probes).toHaveLength(1);
    expect(experiment.probes[0]!.color).toBe(probe.color);
  });
});

describe("isProbeNameAvailable", () => {
  it("returns true when no probe uses the candidate name", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    addProbe(experiment, makeExperimentProbe({ name: "a" }));

    expect(isProbeNameAvailable(experiment, makeExperimentProbe(), "b")).toBe(
      true
    );
  });

  it("returns true for the probe's own current name", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const probe = makeExperimentProbe({ name: "a" });
    addProbe(experiment, probe);

    expect(isProbeNameAvailable(experiment, probe, "a")).toBe(true);
  });

  it("returns false when another probe already uses the name", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    addProbe(experiment, makeExperimentProbe({ name: "a" }));
    const other = makeExperimentProbe({ name: "b" });
    addProbe(experiment, other);

    expect(isProbeNameAvailable(experiment, other, "a")).toBe(false);
  });

  it("trims the candidate before comparing", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    addProbe(experiment, makeExperimentProbe({ name: "b" }));
    const other = makeExperimentProbe({ name: "a" });
    addProbe(experiment, other);

    expect(isProbeNameAvailable(experiment, other, " b ")).toBe(false);
  });

  it("returns true on an experiment with no probes", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);

    expect(isProbeNameAvailable(experiment, makeExperimentProbe(), "a")).toBe(
      true
    );
  });

  it("returns true for an empty candidate when no probe is named that", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    addProbe(experiment, makeExperimentProbe({ name: "a" }));

    expect(isProbeNameAvailable(experiment, makeExperimentProbe(), "")).toBe(
      true
    );
  });
});

describe("removeProbe", () => {
  it("removes the probe from the experiment", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe({ probeIdentifier: identifier });
    addProbe(experiment, probe);

    removeProbe(experiment, probe);

    expect(experiment.probes).toEqual([]);
  });

  it("is a no-op when the probe isn't in the experiment", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = internProbeInterfaceProbe(experiment, makeProbe());
    const kept = makeExperimentProbe({
      name: "kept",
      probeIdentifier: identifier
    });
    addProbe(experiment, kept);

    removeProbe(experiment, makeExperimentProbe({ name: "never-added" }));

    expect(experiment.probes).toEqual([kept]);
  });

  it("drops the probe's definition once no probe references it anymore", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = internProbeInterfaceProbe(experiment, makeProbe());
    const probe = makeExperimentProbe({ probeIdentifier: identifier });
    addProbe(experiment, probe);

    removeProbe(experiment, probe);

    expect(experiment.probeInterfaceProbes).toEqual({});
  });

  it("keeps a definition still referenced by another probe", () => {
    const experiment = buildExperiment("Exp", makeAtlas(), [0, 0, 0]);
    const identifier = internProbeInterfaceProbe(experiment, makeProbe());
    const a = makeExperimentProbe({ name: "a", probeIdentifier: identifier });
    const b = makeExperimentProbe({ name: "b", probeIdentifier: identifier });
    addProbe(experiment, a);
    addProbe(experiment, b);

    removeProbe(experiment, a);

    expect(Object.keys(experiment.probeInterfaceProbes)).toHaveLength(1);
    expect(getInternedProbeInterfaceProbe(experiment, b)).not.toBeNull();
  });
});
