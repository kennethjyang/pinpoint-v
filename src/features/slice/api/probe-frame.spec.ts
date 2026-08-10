import { describe, expect, it } from "vitest";
import { BUILT_IN_TRANSFORM_CHAINS } from "@/features/scene";
import {
  makeProbe,
  makeTransformChain,
  makeTransformInputs
} from "@/test/fixtures";
import { getProbeFrame, toAtlasMillimeters } from "./probe-frame.api";

const DEFAULT_CHAIN = BUILT_IN_TRANSFORM_CHAINS[0]!;

describe("getProbeFrame", () => {
  it("resolves the origin as referenceCoordinate + the resolved position elementwise", () => {
    const probe = makeProbe({
      transformInputs: makeTransformInputs({ globalTranslation: [1, 2, 3] })
    });

    const frame = getProbeFrame(probe, DEFAULT_CHAIN, [10, 20, 30]);

    expect(frame.originMillimeters).toEqual([11, 22, 33]);
  });

  it("offsets the origin along the frame's up axis for a local translation", () => {
    // The default chain's local translation acts after both rotations, so its
    // AP component advances the tip up the shanks rather than along atlas AP.
    const inputs = {
      globalTranslation: [1, 2, 3] as [number, number, number],
      globalRotation: [0, 0, Math.PI / 2] as [number, number, number]
    };
    const unshifted = getProbeFrame(
      makeProbe({ transformInputs: makeTransformInputs(inputs) }),
      DEFAULT_CHAIN,
      [0, 0, 0]
    );

    const frame = getProbeFrame(
      makeProbe({
        transformInputs: makeTransformInputs({
          ...inputs,
          localTranslation: [0.5, 0, 0]
        })
      }),
      DEFAULT_CHAIN,
      [0, 0, 0]
    );

    for (let axis = 0; axis < 3; axis++) {
      expect(frame.originMillimeters[axis]).toBeCloseTo(
        unshifted.originMillimeters[axis]! +
          0.5 * unshifted.upMillimeters[axis]!,
        6
      );
    }
    expect(frame.originMillimeters).not.toEqual(unshifted.originMillimeters);
    // A translation never turns the probe, so the basis is untouched.
    expect(frame.rightMillimeters).toEqual(unshifted.rightMillimeters);
    expect(frame.upMillimeters).toEqual(unshifted.upMillimeters);
  });

  it("resolves right and up for the default probe rotation", () => {
    // Default probe global rotation [0, 0, pi/2]: electrodes face superior,
    // tip faces anterior. right = across the shanks (ML), up = from the tip
    // (DV superior).
    const probe = makeProbe({
      transformInputs: makeTransformInputs({
        globalRotation: [0, 0, Math.PI / 2]
      })
    });

    const frame = getProbeFrame(probe, DEFAULT_CHAIN, [0, 0, 0]);

    expect(frame.rightMillimeters[0]).toBeCloseTo(0, 6);
    expect(frame.rightMillimeters[1]).toBeCloseTo(0, 6);
    expect(frame.rightMillimeters[2]).toBeCloseTo(1, 6);

    expect(frame.upMillimeters[0]).toBeCloseTo(0, 6);
    expect(frame.upMillimeters[1]).toBeCloseTo(-1, 6);
    expect(frame.upMillimeters[2]).toBeCloseTo(0, 6);
  });

  it("builds the basis from the resolved rotation, composing the global and local pitch", () => {
    // Both pitches turn about the same axis here, so together they must land
    // on the basis a single pi/2 global pitch produces. The built-in default
    // fixes local rotation at zero, so this needs a chain that drives it.
    const probe = makeProbe({
      transformInputs: makeTransformInputs({
        globalRotation: [0, 0, Math.PI / 4],
        localRotation: [0, 0, Math.PI / 4]
      })
    });

    const frame = getProbeFrame(probe, makeTransformChain(), [0, 0, 0]);

    expect(frame.rightMillimeters[0]).toBeCloseTo(0, 6);
    expect(frame.rightMillimeters[1]).toBeCloseTo(0, 6);
    expect(frame.rightMillimeters[2]).toBeCloseTo(1, 6);

    expect(frame.upMillimeters[0]).toBeCloseTo(0, 6);
    expect(frame.upMillimeters[1]).toBeCloseTo(-1, 6);
    expect(frame.upMillimeters[2]).toBeCloseTo(0, 6);
  });

  it("keeps the basis unit-length and orthogonal under an arbitrary rotation", () => {
    const probe = makeProbe({
      transformInputs: makeTransformInputs({
        globalRotation: [0.3, -0.7, 1.1]
      })
    });

    const frame = getProbeFrame(probe, DEFAULT_CHAIN, [0, 0, 0]);
    const [rightA, rightS, rightR] = frame.rightMillimeters;
    const [upA, upS, upR] = frame.upMillimeters;

    expect(Math.hypot(rightA, rightS, rightR)).toBeCloseTo(1, 6);
    expect(Math.hypot(upA, upS, upR)).toBeCloseTo(1, 6);
    expect(rightA * upA + rightS * upS + rightR * upR).toBeCloseTo(0, 6);
  });
});

describe("toAtlasMillimeters", () => {
  it("returns the frame's origin at (0, 0)", () => {
    const probe = makeProbe({
      transformInputs: makeTransformInputs({ globalTranslation: [1, 2, 3] })
    });
    const frame = getProbeFrame(probe, DEFAULT_CHAIN, [0, 0, 0]);

    expect(toAtlasMillimeters(frame, 0, 0)).toEqual(frame.originMillimeters);
  });

  it("moves along right and up by the given probe-local offsets", () => {
    const probe = makeProbe({
      transformInputs: makeTransformInputs({
        globalRotation: [0, 0, Math.PI / 2]
      })
    });
    const frame = getProbeFrame(probe, DEFAULT_CHAIN, [0, 0, 0]);

    const result = toAtlasMillimeters(frame, 2, 3);

    // right = [0,0,1] (ML), up = [0,-1,0] (DV superior).
    expect(result[0]).toBeCloseTo(0, 6);
    expect(result[1]).toBeCloseTo(-3, 6);
    expect(result[2]).toBeCloseTo(2, 6);
  });
});
