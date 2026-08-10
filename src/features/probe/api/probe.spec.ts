import { describe, expect, it } from "vitest";
import { isProxy, isReactive, reactive, toRaw } from "vue";
import type { Probe } from "../models/probe.model";
import type { ProbeSurfaceChoice } from "../models/probe-surface-choice.model";
import {
  buildProbe,
  copyProbe,
  detachProbeInterfaceProbe,
  detachProbeInterfaceProbes,
  findProbeInterfaceProbeByIdentifier,
  getManufacturerDisplayName,
  getProbeInterfaceDisplayName,
  getProbeInterfaceIdentifier,
  getProbeModelDisplayName,
  homeProbe,
  insertProbeTipToMillimeters,
  isProbe,
  isProbeInterfaceProbe,
  isProbeSurfaceChoiceCurrent,
  rotateProbeVisibility,
  setProbeTipMillimeters,
  toggleProbeLock
} from "./probe.api";
import {
  addProbe,
  buildExperiment,
  referenceRelativeToAtlas
} from "@/features/experiment";
import type { TransformChain } from "@/features/scene";
import {
  BUILT_IN_TRANSFORM_CHAINS,
  DEFAULT_TRANSFORM_CHAIN_ID,
  getTransformChainPose,
  TRANSFORM_INPUT_GROUPS
} from "@/features/scene";
import {
  makeAtlas,
  makeProbe,
  makeProbeInterfaceProbe,
  makeSceneModel,
  makeTransformInputs
} from "@/test/fixtures";

/** The built-in default chain every fixture probe references. */
const DEFAULT_CHAIN = BUILT_IN_TRANSFORM_CHAINS[0]!;

/** Every one of the twelve input slots, as group/component pairs. */
const TRANSFORM_INPUT_SLOTS = TRANSFORM_INPUT_GROUPS.flatMap(group =>
  ([0, 1, 2] as const).map(component => ({ group, component }))
);

describe("buildProbe", () => {
  it("references the given probe identifier", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec", model_name: "np1" }
    });
    const probe = buildProbe(spec, DEFAULT_TRANSFORM_CHAIN_ID);
    expect(probe.probeInterfaceIdentifier).toBe("imec np1");
  });

  it("builds a probe with sensible defaults, starting pitched inferiorly", () => {
    const probe = buildProbe(makeProbeInterfaceProbe(), "chain-abc");

    expect(probe.inspectableKind).toBe("probe");
    expect(probe.visibility).toBe("visible");
    expect(probe.lock).toBe(false);
    expect(probe.transformChainId).toBe("chain-abc");
    // A pitch of 0 would lie flat, pointing anteriorly; PI/2 is the intended
    // starting default so a new probe points inferiorly.
    expect(probe.transformInputs.globalRotation[2]).toBe(Math.PI / 2);
    expect(probe.transformInputs).toEqual(
      makeTransformInputs({ globalRotation: [0, 0, Math.PI / 2] })
    );
    expect(probe.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(probe.name).toMatch(/^Probe /);
    expect(probe.color).toMatch(/^#/);
    // Null, not a fixed mm value - the slice view defaults this
    // proportionally to whichever atlas is current.
    expect(probe.sliceExtentMillimeters).toBeNull();
    expect(probe.sliceCenterHeightMillimeters).toBe(0);
    expect(probe.channelMapWindow).toBeNull();
    expect(probe.bodyModel).toBeNull();
  });

  it("gives each probe a unique id", () => {
    const a = buildProbe(makeProbeInterfaceProbe(), DEFAULT_TRANSFORM_CHAIN_ID);
    const b = buildProbe(makeProbeInterfaceProbe(), DEFAULT_TRANSFORM_CHAIN_ID);
    expect(a.id).not.toBe(b.id);
  });
});

describe("getProbeIdentifier", () => {
  it("returns the manufacturer and model name", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec", model_name: "np1" }
    });
    expect(getProbeInterfaceIdentifier(spec)).toBe("imec np1");
  });

  it("returns the same identifier for definitions differing only in geometry", () => {
    const a = makeProbeInterfaceProbe({ si_units: "um" });
    const b = makeProbeInterfaceProbe({ si_units: "mm" });
    expect(getProbeInterfaceIdentifier(a)).toBe(getProbeInterfaceIdentifier(b));
  });
});

describe("detachProbeInterfaceProbe", () => {
  it("returns a structurally equal copy", () => {
    const spec = makeProbeInterfaceProbe();
    const detached = detachProbeInterfaceProbe(spec);
    expect(detached).toEqual(spec);
  });

  it("returns an object independent of the source", () => {
    const spec = makeProbeInterfaceProbe();
    const detached = detachProbeInterfaceProbe(spec);

    expect(detached).not.toBe(spec);
    expect(detached.contact_positions).not.toBe(spec.contact_positions);

    // Mutating the source afterwards must not affect the detached copy, and
    // vice versa -- they must not share nested structure.
    spec.contact_positions.push([9, 9]);
    expect(detached.contact_positions).toEqual([[0, 0]]);
  });

  it("opts the returned object out of Vue's reactivity", () => {
    const detached = detachProbeInterfaceProbe(makeProbeInterfaceProbe());
    const holder = reactive({ spec: detached });

    expect(isReactive(holder.spec)).toBe(false);
  });

  it("accepts a reactive proxy without throwing, and does not mark the source raw", () => {
    const source = reactive(makeProbeInterfaceProbe());

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
    const probe = makeProbe({ visibility: "visible" });

    rotateProbeVisibility(probe);
    expect(probe.visibility).toBe("shanks");

    rotateProbeVisibility(probe);
    expect(probe.visibility).toBe("hidden");

    rotateProbeVisibility(probe);
    expect(probe.visibility).toBe("visible");
  });
});

describe("homeProbe", () => {
  it("zeroes both translation groups, leaving the rotations untouched", () => {
    const probe = makeProbe({
      transformInputs: makeTransformInputs({
        globalTranslation: [1, 2, 3],
        globalRotation: [0.1, 0.2, 0.3],
        localRotation: [0.4, 0.5, 0.6],
        localTranslation: [4, 5, 6]
      })
    });

    homeProbe(probe);

    expect(probe.transformInputs.globalTranslation).toEqual([0, 0, 0]);
    expect(probe.transformInputs.localTranslation).toEqual([0, 0, 0]);
    expect(probe.transformInputs.globalRotation).toEqual([0.1, 0.2, 0.3]);
    expect(probe.transformInputs.localRotation).toEqual([0.4, 0.5, 0.6]);
  });
});

describe("setProbeTipMillimeters", () => {
  const referenceCoordinate: [number, number, number] = [1, 2, 3];

  it("lands the resolved tip on the atlas point, whatever the local inputs hold", () => {
    const probe = makeProbe({
      transformInputs: makeTransformInputs({
        globalRotation: [0, 0, Math.PI / 2],
        localTranslation: [1.5, 0, 0]
      })
    });

    setProbeTipMillimeters(
      probe,
      DEFAULT_CHAIN,
      [4, 6, 8],
      referenceCoordinate
    );

    const tip = referenceRelativeToAtlas(
      referenceCoordinate,
      getTransformChainPose(DEFAULT_CHAIN, probe.transformInputs).position
    );
    expect(tip[0]).toBeCloseTo(4);
    expect(tip[1]).toBeCloseTo(6);
    expect(tip[2]).toBeCloseTo(8);
  });
});

describe("insertProbeTipToMillimeters", () => {
  const referenceCoordinate: [number, number, number] = [1, 2, 3];

  it("advances only the chain's depth input", () => {
    const probe = makeProbe();

    const moved = insertProbeTipToMillimeters(
      probe,
      DEFAULT_CHAIN,
      [4, 2, 3],
      referenceCoordinate
    );

    expect(moved).toBe(true);
    // The default chain inserts along probe-local AP, which is unrotated here.
    expect(probe.transformInputs.localTranslation[0]).toBeCloseTo(3);
    expect(probe.transformInputs.localTranslation[1]).toBe(0);
    expect(probe.transformInputs.localTranslation[2]).toBe(0);
    expect(probe.transformInputs.globalTranslation).toEqual([0, 0, 0]);
  });

  it("reaches only along the depth axis, ignoring off-axis distance", () => {
    const probe = makeProbe();

    insertProbeTipToMillimeters(
      probe,
      DEFAULT_CHAIN,
      [4, 9, 3],
      referenceCoordinate
    );

    const { position } = getTransformChainPose(
      DEFAULT_CHAIN,
      probe.transformInputs
    );
    expect(position[0]).toBeCloseTo(3);
    expect(position[1]).toBeCloseTo(0);
    expect(position[2]).toBeCloseTo(0);
  });

  it("returns false and leaves the inputs alone for a chain with no depth axis", () => {
    const chain: TransformChain = {
      ...DEFAULT_CHAIN,
      id: "no-depth",
      isBuiltIn: false,
      depthAxis: null
    };
    const probe = makeProbe();

    const moved = insertProbeTipToMillimeters(
      probe,
      chain,
      [4, 2, 3],
      referenceCoordinate
    );

    expect(moved).toBe(false);
    expect(probe.transformInputs).toEqual(makeTransformInputs());
  });
});

describe("isProbeSurfaceChoiceCurrent", () => {
  /**
   * Snapshot a probe's inputs into a pending surface choice.
   * @param probe Probe to snapshot.
   */
  function makeSurfaceChoice(probe: Probe): ProbeSurfaceChoice {
    return {
      probeId: probe.id,
      transformInputs: structuredClone(probe.transformInputs),
      tipMillimeters: [0, 0, 0],
      axisTargetMillimeters: [1, 0, 0],
      dorsoventralTargetMillimeters: [0, 1, 0]
    };
  }

  it("stays current while the probe's inputs are untouched", () => {
    const probe = makeProbe({
      transformInputs: makeTransformInputs({
        globalTranslation: [1, 2, 3],
        localRotation: [0.1, 0.2, 0.3]
      })
    });

    expect(isProbeSurfaceChoiceCurrent(makeSurfaceChoice(probe), probe)).toBe(
      true
    );
  });

  it("drops once any of the twelve inputs changes", () => {
    for (const { group, component } of TRANSFORM_INPUT_SLOTS) {
      const probe = makeProbe();
      const choice = makeSurfaceChoice(probe);

      probe.transformInputs[group][component] += 0.5;

      expect(isProbeSurfaceChoiceCurrent(choice, probe)).toBe(false);
    }
  });
});

describe("copyProbe", () => {
  it("inserts a copy directly after the source, with a fresh id and a copy-suffixed name", () => {
    const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
    const first = makeProbe({ name: "A" });
    const second = makeProbe({ name: "B" });
    addProbe(experiment, first);
    addProbe(experiment, second);

    const copy = copyProbe(experiment, first);

    expect(experiment.probes).toHaveLength(3);
    expect(experiment.probes[1]).toBe(copy);
    expect(copy!.id).not.toBe(first.id);
    expect(copy!.name).toBe("A - copy");
    expect(copy).toEqual({ ...first, id: copy!.id, name: copy!.name });
  });

  it("copies a locked source as locked", () => {
    const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
    const probe = makeProbe({ lock: true });
    addProbe(experiment, probe);

    const copy = copyProbe(experiment, probe);

    expect(copy!.lock).toBe(true);
  });

  it("deep-copies mutable fields, independent of the source", () => {
    const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
    const probe = makeProbe({
      transformInputs: makeTransformInputs({ globalTranslation: [1, 2, 3] })
    });
    addProbe(experiment, probe);

    const copy = copyProbe(experiment, probe)!;
    copy.transformInputs.globalTranslation[0] = 99;

    expect(probe.transformInputs.globalTranslation[0]).toBe(1);
  });

  it("returns null and leaves the experiment untouched when the probe isn't there", () => {
    const experiment = buildExperiment("experiment", makeAtlas(), [0, 0, 0]);
    const probe = makeProbe();

    const copy = copyProbe(experiment, probe);

    expect(copy).toBeNull();
    expect(experiment.probes).toEqual([]);
  });
});

describe("toggleProbeLock", () => {
  it("flips lock false -> true -> false", () => {
    const probe = makeProbe({ lock: false });

    toggleProbeLock(probe);
    expect(probe.lock).toBe(true);

    toggleProbeLock(probe);
    expect(probe.lock).toBe(false);
  });
});

describe("getProbeInterfaceDisplayName", () => {
  it("combines the known manufacturer name and known model description", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec", model_name: "NP1000" }
    });
    expect(getProbeInterfaceDisplayName(spec)).toBe(
      "IMEC Neuropixels 1.0 probe (NP1000)"
    );
  });

  it("trims a known description with trailing whitespace", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec", model_name: "NP1014" }
    });
    expect(getProbeInterfaceDisplayName(spec)).not.toMatch(/\s$/);
  });

  it("falls back to the raw model name for a known manufacturer", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "cambridgeneurotech", model_name: "ASSY-1" }
    });
    expect(getProbeInterfaceDisplayName(spec)).toBe(
      "Cambridge NeuroTech ASSY-1"
    );
  });

  it("falls back to the raw manufacturer and model name when both are unknown", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "acme", model_name: "widget-9" }
    });
    expect(getProbeInterfaceDisplayName(spec)).toBe("acme widget-9");
  });
});

describe("getManufacturerDisplayName", () => {
  it("returns the proper noun for a known manufacturer", () => {
    expect(getManufacturerDisplayName("cambridgeneurotech")).toBe(
      "Cambridge NeuroTech"
    );
  });

  it("falls back to the raw name for an unknown manufacturer", () => {
    expect(getManufacturerDisplayName("acme")).toBe("acme");
  });
});

describe("getProbeModelDisplayName", () => {
  it("returns the known description for a recognized model", () => {
    expect(getProbeModelDisplayName("imec", "NP2013")).toBe(
      "Neuropixels 2.0 multishank probe"
    );
  });

  it("trims a known description with trailing whitespace", () => {
    expect(getProbeModelDisplayName("imec", "NP1014")).not.toMatch(/\s$/);
  });

  it("falls back to the raw model name for an unrecognized model", () => {
    expect(getProbeModelDisplayName("imec", "nope")).toBe("nope");
  });
});

describe("detachProbeInterfaceProbes", () => {
  it("detaches every entry from reactivity in place", () => {
    const specA = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec", model_name: "np1" }
    });
    const specB = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec", model_name: "np2" }
    });
    const record = reactive({ a: specA, b: specB });

    detachProbeInterfaceProbes(record);

    expect(isReactive(record.a)).toBe(false);
    expect(isReactive(record.b)).toBe(false);
    expect(toRaw(record.a)).toEqual(specA);
    expect(toRaw(record.b)).toEqual(specB);
  });

  it("replaces each entry with a fresh reference", () => {
    const spec = makeProbeInterfaceProbe();
    const record: Record<string, typeof spec> = { a: spec };

    detachProbeInterfaceProbes(record);

    expect(record.a).not.toBe(spec);
  });
});

describe("isProbeInterfaceProbe", () => {
  it("accepts a well-formed probe interface definition", () => {
    expect(isProbeInterfaceProbe(makeProbeInterfaceProbe())).toBe(true);
  });

  it("rejects null", () => {
    expect(isProbeInterfaceProbe(null)).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isProbeInterfaceProbe("not an object")).toBe(false);
  });

  it("rejects a definition missing ndim", () => {
    const { ndim: _ndim, ...spec } = makeProbeInterfaceProbe();
    expect(isProbeInterfaceProbe(spec)).toBe(false);
  });

  it("rejects a definition missing si_units", () => {
    const { si_units: _si_units, ...spec } = makeProbeInterfaceProbe();
    expect(isProbeInterfaceProbe(spec)).toBe(false);
  });

  it("rejects a definition missing contact_positions", () => {
    const { contact_positions: _contactPositions, ...spec } =
      makeProbeInterfaceProbe();
    expect(isProbeInterfaceProbe(spec)).toBe(false);
  });

  it("rejects a definition missing annotations", () => {
    const { annotations: _annotations, ...spec } = makeProbeInterfaceProbe();
    expect(isProbeInterfaceProbe(spec)).toBe(false);
  });

  it("rejects a definition missing model_name from annotations", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec" }
    });
    expect(isProbeInterfaceProbe(spec)).toBe(false);
  });

  it("rejects a definition missing manufacturer from annotations", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { model_name: "np1" }
    });
    expect(isProbeInterfaceProbe(spec)).toBe(false);
  });
});

describe("isProbe", () => {
  it("accepts a well-formed probe", () => {
    expect(isProbe(makeProbe())).toBe(true);
  });

  it("rejects null", () => {
    expect(isProbe(null)).toBe(false);
  });

  it("rejects a probe with the wrong inspectableKind", () => {
    expect(isProbe({ ...makeProbe(), inspectableKind: "atlas" })).toBe(false);
  });

  it("rejects a probe with an empty id", () => {
    expect(isProbe({ ...makeProbe(), id: "" })).toBe(false);
  });

  it("rejects a probe with an invalid color", () => {
    expect(isProbe({ ...makeProbe(), color: "red" })).toBe(false);
  });

  it("rejects a probe with an unknown visibility", () => {
    expect(isProbe({ ...makeProbe(), visibility: "invisible" })).toBe(false);
  });

  it("rejects a probe with a non-boolean lock", () => {
    expect(isProbe({ ...makeProbe(), lock: "yes" })).toBe(false);
  });

  it("rejects a probe missing lock", () => {
    const probe = makeProbe();
    delete (probe as Partial<Probe>).lock;
    expect(isProbe(probe)).toBe(false);
  });

  it("rejects a probe with an empty transformChainId", () => {
    expect(isProbe({ ...makeProbe(), transformChainId: "" })).toBe(false);
  });

  it("rejects a probe with a short translation input", () => {
    const transformInputs = makeTransformInputs({
      globalTranslation: [0, 0] as unknown as [number, number, number]
    });
    expect(isProbe({ ...makeProbe(), transformInputs })).toBe(false);
  });

  it("rejects a probe with a non-finite rotation input", () => {
    const transformInputs = makeTransformInputs({
      globalRotation: [0, 0, NaN]
    });
    expect(isProbe({ ...makeProbe(), transformInputs })).toBe(false);
  });

  it("rejects the old tipPosition and rotation shape", () => {
    const {
      transformChainId: _chainId,
      transformInputs: _inputs,
      ...rest
    } = makeProbe();
    expect(
      isProbe({ ...rest, tipPosition: [0, 0, 0], rotation: [0, 0, 0] })
    ).toBe(false);
  });

  it("accepts a probe with a null sliceExtentMillimeters", () => {
    expect(isProbe(makeProbe({ sliceExtentMillimeters: null }))).toBe(true);
  });

  it("rejects a probe with a non-numeric, non-null sliceExtentMillimeters", () => {
    expect(isProbe({ ...makeProbe(), sliceExtentMillimeters: "8" })).toBe(
      false
    );
  });

  it("rejects a probe missing sliceCenterHeightMillimeters", () => {
    const probe = makeProbe();
    delete (probe as Partial<Probe>).sliceCenterHeightMillimeters;
    expect(isProbe(probe)).toBe(false);
  });

  it("rejects a probe with a non-finite sliceCenterHeightMillimeters", () => {
    expect(isProbe({ ...makeProbe(), sliceCenterHeightMillimeters: NaN })).toBe(
      false
    );
  });

  it("accepts a probe with a null channelMapWindow", () => {
    expect(isProbe(makeProbe({ channelMapWindow: null }))).toBe(true);
  });

  it("accepts a probe with a well-formed channelMapWindow", () => {
    expect(isProbe(makeProbe({ channelMapWindow: { min: 2, max: 6 } }))).toBe(
      true
    );
  });

  it("rejects a probe missing channelMapWindow", () => {
    const probe = makeProbe();
    delete (probe as Partial<Probe>).channelMapWindow;
    expect(isProbe(probe)).toBe(false);
  });

  it("rejects a probe with a non-numeric channelMapWindow bound", () => {
    expect(
      isProbe(
        makeProbe({
          channelMapWindow: { min: "0", max: 1 } as unknown as {
            min: number;
            max: number;
          }
        })
      )
    ).toBe(false);
  });

  it("rejects a probe with an inverted channelMapWindow", () => {
    expect(isProbe(makeProbe({ channelMapWindow: { min: 5, max: 1 } }))).toBe(
      false
    );
  });

  it("rejects a probe with a negative channelMapWindow", () => {
    expect(isProbe(makeProbe({ channelMapWindow: { min: -1, max: 1 } }))).toBe(
      false
    );
  });

  it("accepts a probe with a null bodyModel", () => {
    expect(isProbe(makeProbe({ bodyModel: null }))).toBe(true);
  });

  it("accepts a probe with a well-formed bodyModel", () => {
    expect(isProbe(makeProbe({ bodyModel: makeSceneModel() }))).toBe(true);
  });

  it("rejects a probe missing bodyModel", () => {
    const probe = makeProbe();
    delete (probe as Partial<Probe>).bodyModel;
    expect(isProbe(probe)).toBe(false);
  });

  it("rejects a probe with a malformed bodyModel", () => {
    expect(
      isProbe(makeProbe({ bodyModel: { id: "a" } as unknown as null }))
    ).toBe(false);
  });
});

describe("findProbeInterfaceProbeByIdentifier", () => {
  it("returns the definition matching the identifier", () => {
    const spec = makeProbeInterfaceProbe({
      annotations: { manufacturer: "imec", model_name: "np1" }
    });

    expect(
      findProbeInterfaceProbeByIdentifier(
        [spec],
        getProbeInterfaceIdentifier(spec)
      )
    ).toEqual(spec);
  });

  it("returns null when no definition matches", () => {
    expect(
      findProbeInterfaceProbeByIdentifier(
        [makeProbeInterfaceProbe()],
        "missing identifier"
      )
    ).toBeNull();
  });
});
