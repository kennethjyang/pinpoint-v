import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "@babylonjs/core";
import type {
  TransformChain,
  TransformInputs
} from "../models/transform-chain.model";
import {
  BUILT_IN_TRANSFORM_CHAINS,
  buildTransformInputs,
  copyTransformChain,
  DEFAULT_TRANSFORM_CHAIN_ID,
  findTransformChain,
  getTransformChainDepthDirection,
  getTransformChainHandles,
  getTransformChainLabel,
  getTransformChainPose,
  getTransformChains,
  isTransformChain,
  isTransformInputBound,
  isTransformInputNames,
  isTransformInputs,
  moveTransformChainOrigin,
  moveTransformChainOriginAlongDepth
} from "./transform-chain.api";
import { asrToVector3 } from "./coordinate-transforms.api";
import { makeTransformChain } from "@/test/fixtures";

/** The built-in chain every 3D model uses unless told otherwise. */
const DEFAULT_CHAIN = BUILT_IN_TRANSFORM_CHAINS[0]!;

/**
 * Build transform inputs from partial groups, so a test names only the values
 * it cares about.
 */
function makeInputs(overrides: Partial<TransformInputs> = {}): TransformInputs {
  return { ...buildTransformInputs(), ...overrides };
}

/** Assert two triples match to within floating point noise. */
function expectTriple(
  actual: [number, number, number],
  expected: [number, number, number]
): void {
  actual.forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index]!, 10);
  });
}

/** Assert a vector points where expected, to within floating point noise. */
function expectVector(
  actual: Vector3,
  expected: [number, number, number]
): void {
  expect(actual.subtract(Vector3.FromArray(expected)).length()).toBeCloseTo(
    0,
    10
  );
}

/** Assert two quaternions describe the same rotation, ignoring their sign. */
function expectRotation(actual: Quaternion, expected: Quaternion): void {
  expect(Math.abs(Quaternion.Dot(actual, expected))).toBeCloseTo(1, 6);
}

describe("getTransformChainPose", () => {
  it("maps the global groups and the local roll straight onto the pose", () => {
    const inputs = makeInputs({
      globalTranslation: [1.5, -2.25, 0.75],
      globalRotation: [0, 0.2, 0.3],
      localRotation: [0.1, 0, 0]
    });

    const pose = getTransformChainPose(DEFAULT_CHAIN, inputs);

    expect(pose.position).toEqual([1.5, -2.25, 0.75]);
    expectTriple(pose.rotation, [0.1, 0.2, 0.3]);
  });

  it("keeps a probe's default inferior pitch exactly", () => {
    const pose = getTransformChainPose(
      DEFAULT_CHAIN,
      makeInputs({ globalRotation: [0, 0, Math.PI / 2] })
    );

    expect(pose.position).toEqual([0, 0, 0]);
    expect(pose.rotation).toEqual([0, 0, Math.PI / 2]);
  });

  it("leaves the pose at the parent origin when every input is zero", () => {
    const pose = getTransformChainPose(DEFAULT_CHAIN, buildTransformInputs());

    expect(pose.position).toEqual([0, 0, 0]);
    expect(pose.rotation).toEqual([0, 0, 0]);
  });

  it("runs local translation along the object's own rotated axes", () => {
    // Pitch of -90 degrees turns probe-local up (+Z, i.e. AP) onto atlas DV.
    const pose = getTransformChainPose(
      DEFAULT_CHAIN,
      makeInputs({
        globalTranslation: [1, 2, 3],
        globalRotation: [0, 0, -Math.PI / 2],
        localTranslation: [4, 0, 0]
      })
    );

    expectTriple(pose.position, [1, 2 + 4, 3]);
    expectTriple(pose.rotation, [0, 0, -Math.PI / 2]);
  });

  it("composes local rotation on top of global rotation", () => {
    const pose = getTransformChainPose(
      makeTransformChain(),
      makeInputs({ globalRotation: [0, 0.25, 0], localRotation: [0, 0.5, 0] })
    );

    expectTriple(pose.rotation, [0, 0.75, 0]);
  });

  it("leaves the default chain's unbound axes alone", () => {
    // The default drives the depth axis, the two global angles and the local
    // roll only, so the rest of the inputs are inert.
    const pose = getTransformChainPose(
      DEFAULT_CHAIN,
      makeInputs({
        globalRotation: [0.1, 0, 0],
        localTranslation: [1, 2, 3],
        localRotation: [0, 0.2, 0.3]
      })
    );

    expectTriple(pose.position, [1, 0, 0]);
    expectTriple(pose.rotation, [0, 0, 0]);
  });

  it("reads fixed arguments instead of inputs", () => {
    const chain: TransformChain = {
      id: "fixed",
      name: "Fixed",
      isBuiltIn: false,
      steps: [{ kind: "translation", arguments: [-1, 0, 0] }],
      depthAxis: null
    };

    const pose = getTransformChainPose(chain, makeInputs());

    expect(pose.position).toEqual([-1, 0, 0]);
  });

  it("routes one input onto a different axis", () => {
    const chain: TransformChain = {
      id: "routed",
      name: "Routed",
      isBuiltIn: false,
      steps: [
        {
          kind: "translation",
          arguments: [{ group: "localTranslation", component: 1 }, 0, 0]
        }
      ],
      depthAxis: null
    };

    const pose = getTransformChainPose(
      chain,
      makeInputs({ localTranslation: [0, 7, 0] })
    );

    expect(pose.position).toEqual([7, 0, 0]);
  });

  it("resolves an empty chain to the identity pose", () => {
    const pose = getTransformChainPose(
      { id: "empty", name: "", isBuiltIn: false, steps: [], depthAxis: null },
      makeInputs({ globalTranslation: [1, 2, 3] })
    );

    expect(pose.position).toEqual([0, 0, 0]);
    expect(pose.rotation).toEqual([0, 0, 0]);
  });
});

describe("getTransformChainHandles", () => {
  it("exposes one handle per input-bound slot and none for fixed values", () => {
    const chain: TransformChain = {
      id: "partial",
      name: "Partial",
      isBuiltIn: false,
      steps: [
        {
          kind: "translation",
          arguments: [{ group: "globalTranslation", component: 0 }, 0, -1]
        }
      ],
      depthAxis: null
    };

    const handles = getTransformChainHandles(chain, makeInputs());

    expect(handles).toHaveLength(1);
    expect(handles[0]!.input).toEqual({
      group: "globalTranslation",
      component: 0
    });
    expect(handles[0]!.component).toBe(0);
    expect(handles[0]!.kind).toBe("translation");
  });

  it("puts translation handles on the object's origin along their step's axes", () => {
    const inputs = makeInputs({
      globalTranslation: [1, 2, 3],
      globalRotation: [0, Math.PI / 2, 0]
    });

    const handles = getTransformChainHandles(DEFAULT_CHAIN, inputs);
    const global = handles.find(
      handle =>
        handle.input.group === "globalTranslation" && handle.component === 0
    )!;
    const local = handles.find(
      handle =>
        handle.input.group === "localTranslation" && handle.component === 0
    )!;

    // Both sit on the object, but the global axis stays in the parent frame
    // while the local one follows the object's 90 degree yaw.
    expect(global.origin.asArray()).toEqual([3, 2, 1]);
    expect(local.origin.asArray()).toEqual([3, 2, 1]);
    expect(global.axis.subtract(new Vector3(0, 0, 1)).length()).toBeCloseTo(
      0,
      10
    );
    expect(local.axis.subtract(new Vector3(1, 0, 0)).length()).toBeCloseTo(
      0,
      10
    );
  });

  it("pivots rotation handles on their step's frame, not the moved object", () => {
    const inputs = makeInputs({
      globalTranslation: [1, 2, 3],
      localTranslation: [5, 0, 0]
    });

    const handles = getTransformChainHandles(DEFAULT_CHAIN, inputs);
    const rotation = handles.find(
      handle =>
        handle.input.group === "globalRotation" && handle.component === 1
    )!;

    // The object sits 5mm up its own axis from the global translation, which
    // is where the global rotation still pivots.
    expect(rotation.origin.asArray()).toEqual([3, 2, 1]);
    expect(rotation.axis.subtract(new Vector3(0, 1, 0)).length()).toBeCloseTo(
      0,
      10
    );
  });

  it("keeps the default chain's global rings on the parent axes whatever it holds", () => {
    const inputs = makeInputs({
      globalRotation: [0, Math.PI / 2, 0.4],
      localRotation: [0.3, 0, 0]
    });
    const handles = getTransformChainHandles(DEFAULT_CHAIN, inputs).filter(
      handle => handle.input.group === "globalRotation"
    );
    const ringFor = (component: 0 | 1 | 2) =>
      handles.find(handle => handle.input.component === component)!;

    // Global rotation acts in the parent frame, so its rings never move: yaw
    // stays on world DV and pitch on world ML however the object is turned.
    // Global roll is unbound, so it has no ring at all.
    expect(handles).toHaveLength(2);
    expectVector(ringFor(1).axis, [0, 1, 0]);
    expectVector(ringFor(2).axis, [1, 0, 0]);
  });

  it("turns the yaw and roll rings by exactly the angle they are dragged", () => {
    const inputs = makeInputs({
      globalRotation: [0, 0.4, Math.PI / 2],
      localRotation: [0.25, 0, 0]
    });
    const delta = 0.2;

    // Yaw is the outermost rotation and the local roll the innermost, so each
    // is exactly a turn about its own ring's axis: the ring follows the pointer.
    for (const input of [
      { group: "globalRotation", component: 1 },
      { group: "localRotation", component: 0 }
    ] as const) {
      const handle = getTransformChainHandles(DEFAULT_CHAIN, inputs).find(
        candidate =>
          candidate.input.group === input.group &&
          candidate.input.component === input.component
      )!;
      const moved = makeInputs({
        globalRotation: [...inputs.globalRotation],
        localRotation: [...inputs.localRotation]
      });
      moved[input.group][input.component] += delta;

      expectRotation(
        Quaternion.FromEulerVector(
          asrToVector3(getTransformChainPose(DEFAULT_CHAIN, moved).rotation)
        ),
        Quaternion.RotationAxis(handle.axis, delta).multiply(
          Quaternion.FromEulerVector(
            asrToVector3(getTransformChainPose(DEFAULT_CHAIN, inputs).rotation)
          )
        )
      );
    }
  });

  it("applies the default chain's pitch before its yaw, whatever its ring shows", () => {
    const inputs = makeInputs({ globalRotation: [0, Math.PI / 2, 0.3] });
    const delta = 0.2;
    const moved = makeInputs({ globalRotation: [0, Math.PI / 2, 0.3 + delta] });

    // Pitch is applied first and yaw wraps it, so adding to pitch turns the
    // object about its own ML axis - the price of a ring that never moves.
    expectRotation(
      Quaternion.FromEulerVector(
        asrToVector3(getTransformChainPose(DEFAULT_CHAIN, moved).rotation)
      ),
      Quaternion.FromEulerVector(
        asrToVector3(getTransformChainPose(DEFAULT_CHAIN, inputs).rotation)
      ).multiply(Quaternion.RotationAxis(new Vector3(1, 0, 0), delta))
    );
  });

  it("puts the local rotation's rings on the frame the global rotation left", () => {
    const handles = getTransformChainHandles(
      makeTransformChain(),
      makeInputs({ globalRotation: [0, Math.PI / 2, 0] })
    ).filter(handle => handle.input.group === "localRotation");

    // A quarter turn of global yaw swaps the frame's own AP and ML axes.
    expectVector(handles[0]!.axis, [1, 0, 0]);
    expectVector(handles[1]!.axis, [0, 1, 0]);
    expectVector(handles[2]!.axis, [0, 0, -1]);
  });

  it("shows the default chain a depth arrow and a roll ring in its local groups", () => {
    const handles = getTransformChainHandles(
      DEFAULT_CHAIN,
      buildTransformInputs()
    ).filter(handle => handle.input.group.startsWith("local"));

    expect(handles).toHaveLength(2);
    expect(handles.map(handle => handle.input)).toEqual([
      { group: "localRotation", component: 0 },
      { group: "localTranslation", component: 0 }
    ]);
    expect(handles.map(handle => handle.kind)).toEqual([
      "rotation",
      "translation"
    ]);
  });

  it("keeps every ring of a global rotation step on the parent axes", () => {
    // A chain may put several angles in one step; a global step still composes
    // them as euler angles, but never moves its rings off the parent's axes.
    const chain: TransformChain = {
      id: "one-step-global-rotation",
      name: "One step global rotation",
      isBuiltIn: false,
      steps: [
        {
          kind: "rotation",
          arguments: [
            { group: "globalRotation", component: 0 },
            { group: "globalRotation", component: 1 },
            0
          ]
        }
      ],
      depthAxis: null
    };
    const inputs = makeInputs({ globalRotation: [0.3, Math.PI / 2, 0] });

    const handles = getTransformChainHandles(chain, inputs);

    expectVector(handles[0]!.axis, [0, 0, 1]);
    expectVector(handles[1]!.axis, [0, 1, 0]);
    expectTriple(getTransformChainPose(chain, inputs).rotation, [
      0.3,
      Math.PI / 2,
      0
    ]);
  });

  it("nests the angles a local rotation step holds together, so only the outermost keeps its frame axis", () => {
    const chain: TransformChain = {
      id: "one-step-rotation",
      name: "One step rotation",
      isBuiltIn: false,
      steps: [
        {
          kind: "rotation",
          arguments: [
            { group: "localRotation", component: 0 },
            { group: "localRotation", component: 1 },
            0
          ]
        }
      ],
      depthAxis: null
    };
    const inputs = makeInputs({ localRotation: [0, Math.PI / 2, 0] });

    const handles = getTransformChainHandles(chain, inputs);

    // Yaw is outermost, so it keeps the frame axis; roll nests inside it.
    expectVector(handles[1]!.axis, [0, 1, 0]);
    expectVector(handles[0]!.axis, [1, 0, 0]);

    // Adding to a nested angle is still exactly a turn about its own axis.
    const delta = 0.2;
    const moved = makeInputs({ localRotation: [delta, Math.PI / 2, 0] });

    expectRotation(
      Quaternion.FromEulerVector(
        asrToVector3(getTransformChainPose(chain, moved).rotation)
      ),
      Quaternion.RotationAxis(handles[0]!.axis, delta).multiply(
        Quaternion.FromEulerVector(
          asrToVector3(getTransformChainPose(chain, inputs).rotation)
        )
      )
    );
  });
});

describe("isTransformInputBound", () => {
  it("reports the default chain's seven driven inputs bound and its five inert ones unbound", () => {
    for (const component of [0, 1, 2] as const) {
      expect(
        isTransformInputBound(DEFAULT_CHAIN, {
          group: "globalTranslation",
          component
        })
      ).toBe(true);
    }
    // Global yaw and pitch aim the object; the roll it needs is the local one,
    // about the depth axis the local translation drives it along.
    for (const input of [
      { group: "globalRotation", component: 1 },
      { group: "globalRotation", component: 2 },
      { group: "localRotation", component: 0 },
      { group: "localTranslation", component: 0 }
    ] as const) {
      expect(isTransformInputBound(DEFAULT_CHAIN, input)).toBe(true);
    }
    for (const input of [
      { group: "globalRotation", component: 0 },
      { group: "localRotation", component: 1 },
      { group: "localRotation", component: 2 },
      { group: "localTranslation", component: 1 },
      { group: "localTranslation", component: 2 }
    ] as const) {
      expect(isTransformInputBound(DEFAULT_CHAIN, input)).toBe(false);
    }
  });

  it("reports an input no step reads as unbound", () => {
    const chain: TransformChain = {
      id: "one-axis",
      name: "One axis",
      isBuiltIn: false,
      steps: [
        {
          kind: "translation",
          arguments: [{ group: "localTranslation", component: 2 }, 0, 0]
        }
      ],
      depthAxis: null
    };

    expect(
      isTransformInputBound(chain, { group: "localTranslation", component: 2 })
    ).toBe(true);
    expect(
      isTransformInputBound(chain, { group: "localTranslation", component: 0 })
    ).toBe(false);
    expect(
      isTransformInputBound(chain, { group: "globalTranslation", component: 0 })
    ).toBe(false);
  });
});

describe("moveTransformChainOrigin", () => {
  it("writes the target straight into the global translation of a fresh probe", () => {
    const inputs = buildTransformInputs();

    moveTransformChainOrigin(inputs, DEFAULT_CHAIN, [1, -2, 3]);

    expect(inputs.globalTranslation).toEqual([1, -2, 3]);
    expect(getTransformChainPose(DEFAULT_CHAIN, inputs).position).toEqual([
      1, -2, 3
    ]);
  });

  it("lands the origin on the target when later steps already offset it", () => {
    const inputs = makeInputs({
      globalTranslation: [4, 4, 4],
      globalRotation: [0, 0, -Math.PI / 2],
      localTranslation: [2, 0, 0]
    });

    moveTransformChainOrigin(inputs, DEFAULT_CHAIN, [1, -2, 3]);

    expectTriple(
      getTransformChainPose(DEFAULT_CHAIN, inputs).position,
      [1, -2, 3]
    );
  });

  it("moves only the bound components of the first translation step", () => {
    const chain: TransformChain = {
      id: "half-fixed",
      name: "Half fixed",
      isBuiltIn: false,
      steps: [
        {
          kind: "translation",
          arguments: [
            { group: "globalTranslation", component: 0 },
            0,
            { group: "globalTranslation", component: 2 }
          ]
        }
      ],
      depthAxis: null
    };
    const inputs = buildTransformInputs();

    moveTransformChainOrigin(inputs, chain, [1, 2, 3]);

    expect(inputs.globalTranslation).toEqual([1, 0, 3]);
    expect(getTransformChainPose(chain, inputs).position).toEqual([1, 0, 3]);
  });

  it("leaves the inputs alone when no translation step reads one", () => {
    const chain: TransformChain = {
      id: "fixed-only",
      name: "Fixed only",
      isBuiltIn: false,
      steps: [{ kind: "translation", arguments: [1, 1, 1] }],
      depthAxis: null
    };
    const inputs = buildTransformInputs();

    moveTransformChainOrigin(inputs, chain, [5, 5, 5]);

    expect(inputs).toEqual(buildTransformInputs());
  });
});

describe("moveTransformChainOriginAlongDepth", () => {
  it("advances the depth input to reach a target on its own axis", () => {
    const inputs = makeInputs({ globalTranslation: [1, 0, 0] });

    // The default depth axis is probe-local +Z, which is AP while unrotated.
    expect(
      moveTransformChainOriginAlongDepth(inputs, DEFAULT_CHAIN, [4, 0, 0])
    ).toBe(true);
    expect(inputs.localTranslation).toEqual([3, 0, 0]);
    expect(inputs.globalTranslation).toEqual([1, 0, 0]);
    expectTriple(
      getTransformChainPose(DEFAULT_CHAIN, inputs).position,
      [4, 0, 0]
    );
  });

  it("follows the object's rotation, so an inserted probe moves along its shanks", () => {
    const inputs = makeInputs({ globalRotation: [0, 0, -Math.PI / 2] });

    moveTransformChainOriginAlongDepth(inputs, DEFAULT_CHAIN, [0, 2, 0]);

    expectTriple(inputs.localTranslation, [2, 0, 0]);
    expectTriple(
      getTransformChainPose(DEFAULT_CHAIN, inputs).position,
      [0, 2, 0]
    );
  });

  it("refuses a chain whose depth axis no translation step reads", () => {
    const chain: TransformChain = {
      id: "no-depth",
      name: "No depth",
      isBuiltIn: false,
      steps: [{ kind: "translation", arguments: [0, 0, 0] }],
      depthAxis: { group: "localTranslation", component: 0 }
    };
    const inputs = buildTransformInputs();

    expect(moveTransformChainOriginAlongDepth(inputs, chain, [1, 1, 1])).toBe(
      false
    );
    expect(inputs).toEqual(buildTransformInputs());
  });
});

describe("getTransformChainDepthDirection", () => {
  it("points along probe-local up for an unrotated default chain", () => {
    const direction = getTransformChainDepthDirection(
      DEFAULT_CHAIN,
      buildTransformInputs()
    );

    expectTriple(direction!, [1, 0, 0]);
  });

  it("rotates with the object", () => {
    const direction = getTransformChainDepthDirection(
      DEFAULT_CHAIN,
      makeInputs({ globalRotation: [0, 0, Math.PI / 2] })
    );

    expectTriple(direction!, [0, -1, 0]);
  });

  it("is null without a depth axis", () => {
    expect(
      getTransformChainDepthDirection(
        { id: "none", name: "", isBuiltIn: false, steps: [], depthAxis: null },
        buildTransformInputs()
      )
    ).toBeNull();
  });
});

describe("findTransformChain", () => {
  it("falls back to the built-in default for an unknown id", () => {
    expect(findTransformChain(getTransformChains([]), "gone").id).toBe(
      DEFAULT_TRANSFORM_CHAIN_ID
    );
  });

  it("returns the user chain the id names", () => {
    const chain = copyTransformChain(DEFAULT_CHAIN, "Mine");

    expect(findTransformChain(getTransformChains([chain]), chain.id)).toBe(
      chain
    );
  });
});

describe("copyTransformChain", () => {
  it("copies the steps into an editable chain sharing no references", () => {
    const copy = copyTransformChain(DEFAULT_CHAIN, "Mine");

    expect(copy.isBuiltIn).toBe(false);
    expect(copy.name).toBe("Mine");
    expect(copy.id).not.toBe(DEFAULT_CHAIN.id);
    expect(copy.steps).toEqual(DEFAULT_CHAIN.steps);
    expect(copy.steps[0]!.arguments[0]).not.toBe(
      DEFAULT_CHAIN.steps[0]!.arguments[0]
    );
    expect(copy.depthAxis).toEqual(DEFAULT_CHAIN.depthAxis);
  });
});

describe("getTransformChainLabel", () => {
  it("translates a built-in chain's name and passes a user chain's through", () => {
    expect(getTransformChainLabel(DEFAULT_CHAIN, key => `t:${key}`)).toBe(
      "t:transformChain.defaultChainName"
    );
    expect(
      getTransformChainLabel(
        copyTransformChain(DEFAULT_CHAIN, "Mine"),
        () => ""
      )
    ).toBe("Mine");
  });
});

describe("isTransformChain", () => {
  it("accepts a chain with fixed and input arguments", () => {
    expect(isTransformChain(DEFAULT_CHAIN)).toBe(true);
    expect(
      isTransformChain({
        id: "a",
        name: "A",
        isBuiltIn: false,
        steps: [{ kind: "rotation", arguments: [0, 1, -2] }],
        depthAxis: null
      })
    ).toBe(true);
  });

  it("rejects malformed chains", () => {
    const base = {
      id: "a",
      name: "A",
      isBuiltIn: false,
      steps: [],
      depthAxis: null
    };

    expect(isTransformChain({ ...base, id: "" })).toBe(false);
    expect(isTransformChain({ ...base, steps: [{ kind: "scale" }] })).toBe(
      false
    );
    expect(
      isTransformChain({
        ...base,
        steps: [{ kind: "translation", arguments: [0, 0] }]
      })
    ).toBe(false);
    expect(
      isTransformChain({
        ...base,
        steps: [
          {
            kind: "translation",
            arguments: [{ group: "nope", component: 0 }, 0, 0]
          }
        ]
      })
    ).toBe(false);
    expect(
      isTransformChain({
        ...base,
        steps: [
          {
            kind: "translation",
            arguments: [{ group: "globalTranslation", component: 3 }, 0, 0]
          }
        ]
      })
    ).toBe(false);
    expect(
      isTransformChain({ ...base, depthAxis: { group: "globalTranslation" } })
    ).toBe(false);
    expect(isTransformChain(null)).toBe(false);
  });
});

describe("isTransformInputs", () => {
  it("accepts a full set of finite triples and rejects gaps", () => {
    expect(isTransformInputs(buildTransformInputs())).toBe(true);
    expect(
      isTransformInputs({ ...buildTransformInputs(), localRotation: [0, 0] })
    ).toBe(false);
    expect(
      isTransformInputs({
        ...buildTransformInputs(),
        globalTranslation: [0, Number.NaN, 0]
      })
    ).toBe(false);
    // The pre-chain probe shape is not a set of inputs.
    expect(isTransformInputs({ tipPosition: [0, 0, 0] })).toBe(false);
  });
});

describe("isTransformInputNames", () => {
  it("requires a non-empty name for every input", () => {
    const names = {
      globalTranslation: ["AP", "DV", "ML"],
      globalRotation: ["Roll", "Yaw", "Pitch"],
      localRotation: ["Roll", "Yaw", "Pitch"],
      localTranslation: ["AP", "DV", "ML"]
    };

    expect(isTransformInputNames(names)).toBe(true);
    expect(
      isTransformInputNames({ ...names, localRotation: ["Roll", "", "Pitch"] })
    ).toBe(false);
    expect(isTransformInputNames({ ...names, globalRotation: ["Roll"] })).toBe(
      false
    );
  });
});
