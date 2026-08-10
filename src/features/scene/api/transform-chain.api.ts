import { Quaternion, Vector3 } from "@babylonjs/core";
import { asrToVector3, vector3ToAsr } from "./coordinate-transforms.api";
import type {
  TransformArgument,
  TransformChain,
  TransformInputComponent,
  TransformInputGroup,
  TransformInputNames,
  TransformInputRef,
  TransformInputs,
  TransformStep,
  TransformStepKind
} from "../models/transform-chain.model";
import { isFiniteNumber, isFiniteTriple, isRecord } from "@/utils/type-guards";

/** One draggable axis a chain exposes, resolved in the object's parent frame. */
export interface TransformHandle {
  /** Input the handle is labelled by, and the only one a drag adds to unless it recomposes. */
  input: TransformInputRef;

  /** Step the handle belongs to, and the argument slot it fills. */
  stepIndex: number;
  component: TransformInputComponent;

  kind: TransformStepKind;

  /**
   * Handle origin: the object's own origin for a translation, the step's pivot
   * for a rotation.
   */
  origin: Vector3;

  /** Unit axis the handle drags along, or rotates about. */
  axis: Vector3;
}

/** A chain step's argument slot resolved back to the input it reads. */
interface TransformInputBinding {
  input: TransformInputRef;
  stepIndex: number;
  component: TransformInputComponent;
}

/** A frame a chain step acts in: rotate by `rotation`, then translate by `position`. */
interface TransformFrame {
  position: Vector3;
  rotation: Quaternion;
}

/** Every input group, in the order the inspectors and the chain editor list them. */
export const TRANSFORM_INPUT_GROUPS: readonly TransformInputGroup[] = [
  "globalTranslation",
  "globalRotation",
  "localRotation",
  "localTranslation"
];

/** Id of the built-in chain every new 3D model uses. */
export const DEFAULT_TRANSFORM_CHAIN_ID = "built-in-default";

/** i18n key naming each built-in chain, keyed by chain id. */
export const BUILT_IN_TRANSFORM_CHAIN_NAME_KEYS: Readonly<
  Record<string, string>
> = {
  [DEFAULT_TRANSFORM_CHAIN_ID]: "transformChain.defaultChainName"
};

/** Component of `localTranslation` the built-in default chain inserts along. */
const DEFAULT_DEPTH_COMPONENT: TransformInputComponent = 0;

/**
 * Locked chains defined in code, always available whatever the user's
 * preferences hold.
 *
 * The default places the object by its global translation, aims it with two
 * independent global rotations - pitch about the parent's ML axis, then yaw
 * about the parent's DV axis, both fixed in the parent frame - rolls it about
 * its own depth axis, and then drives it in along that axis. Global roll is
 * left unbound: the roll a probe needs is the local one.
 */
export const BUILT_IN_TRANSFORM_CHAINS: readonly TransformChain[] = [
  {
    id: DEFAULT_TRANSFORM_CHAIN_ID,
    name: "",
    isBuiltIn: true,
    steps: [
      buildInputStep("translation", "globalTranslation"),
      buildAngleStep("globalRotation", 2),
      buildAngleStep("globalRotation", 1),
      buildAngleStep("localRotation", 0),
      {
        kind: "translation",
        arguments: [
          { group: "localTranslation", component: DEFAULT_DEPTH_COMPONENT },
          0,
          0
        ]
      }
    ],
    depthAxis: {
      group: "localTranslation",
      component: DEFAULT_DEPTH_COMPONENT
    }
  }
];

/** Babylon axis each ASR-ordered component acts on: AP is +Z, DV is +Y, ML is +X. */
const COMPONENT_AXES: readonly [Vector3, Vector3, Vector3] = [
  new Vector3(0, 0, 1),
  new Vector3(0, 1, 0),
  new Vector3(1, 0, 0)
];

/** Every argument slot of a step, for iterating a step's three components. */
const COMPONENTS: readonly TransformInputComponent[] = [0, 1, 2];

/** Build an object's twelve transform inputs, all zeroed. */
export function buildTransformInputs(): TransformInputs {
  return {
    globalTranslation: [0, 0, 0],
    globalRotation: [0, 0, 0],
    localRotation: [0, 0, 0],
    localTranslation: [0, 0, 0]
  };
}

/**
 * Duplicate a chain as a fresh, editable user chain.
 * @param chain Chain to copy the steps and depth axis of.
 * @param name User-facing name of the copy.
 */
export function copyTransformChain(
  chain: TransformChain,
  name: string
): TransformChain {
  return {
    id: crypto.randomUUID(),
    name,
    isBuiltIn: false,
    steps: chain.steps.map(step => ({
      kind: step.kind,
      arguments: step.arguments.map(argument =>
        typeof argument === "number" ? argument : { ...argument }
      ) as [TransformArgument, TransformArgument, TransformArgument]
    })),
    depthAxis: chain.depthAxis ? { ...chain.depthAxis } : null
  };
}

/**
 * Every chain an object can use: the locked built-ins, then the user's own.
 * @param userChains User-defined chains from preferences.
 */
export function getTransformChains(
  userChains: readonly TransformChain[]
): TransformChain[] {
  return [...BUILT_IN_TRANSFORM_CHAINS, ...userChains];
}

/**
 * Find a chain by id, falling back to the built-in default when the id names
 * no chain the user still has.
 * @param chains Chains to search.
 * @param id Chain id to look up.
 */
export function findTransformChain(
  chains: readonly TransformChain[],
  id: string
): TransformChain {
  return chains.find(chain => chain.id === id) ?? BUILT_IN_TRANSFORM_CHAINS[0]!;
}

/**
 * A chain's display name: its own for a user chain, an i18n lookup for a
 * built-in one.
 * @param chain Chain to name.
 * @param translate Resolves an i18n key to its message.
 */
export function getTransformChainLabel(
  chain: TransformChain,
  translate: (key: string) => string
): string {
  if (!chain.isBuiltIn) return chain.name;

  const key = BUILT_IN_TRANSFORM_CHAIN_NAME_KEYS[chain.id];
  return key ? translate(key) : chain.name;
}

/**
 * Resolve a chain and an object's inputs into the object's pose: position in
 * ASR mm from its parent, rotation as ASR-ordered roll, yaw, and pitch.
 * @param chain Chain mapping the inputs onto the pose.
 * @param inputs Object's twelve transform input values.
 */
export function getTransformChainPose(
  chain: TransformChain,
  inputs: TransformInputs
): { position: [number, number, number]; rotation: [number, number, number] } {
  const { pose } = foldTransformChain(chain, inputs);
  const position = vector3ToAsr(pose.position);
  const rotation = vector3ToAsr(pose.rotation.toEulerAngles());
  // Extraction hands back -0 for an untouched axis; adding zero normalizes it
  // so a resolved pose compares equal to plain zeroed state.
  return {
    position: [position[0] + 0, position[1] + 0, position[2] + 0],
    rotation: [rotation[0] + 0, rotation[1] + 0, rotation[2] + 0]
  };
}

/**
 * Every draggable axis the chain exposes, one per argument slot that reads an
 * input. Slots holding fixed values get none.
 *
 * A drag adds straight to the input its handle reads. A step reading a global
 * group acts in the parent frame, so its arrows and rings stay on the parent's
 * own axes however the object is turned. A step reading a local group acts in
 * the frame its predecessors produced, and its rings follow the euler nesting
 * of the angles it holds.
 * @param chain Chain to resolve the handles of.
 * @param inputs Object's twelve transform input values.
 */
export function getTransformChainHandles(
  chain: TransformChain,
  inputs: TransformInputs
): TransformHandle[] {
  const { pose, frames } = foldTransformChain(chain, inputs);

  const handles: TransformHandle[] = [];
  chain.steps.forEach((step, stepIndex) => {
    const frame = frames[stepIndex]!;
    const axes: Vector3[] =
      step.kind === "translation" || isParentFramedStep(step)
        ? COMPONENT_AXES.map(axis =>
            axis.applyRotationQuaternion(frame.rotation)
          )
        : getRotationAxes(frame, readStepArguments(step, inputs));

    for (const component of COMPONENTS) {
      const argument = step.arguments[component];
      if (typeof argument === "number") continue;

      handles.push({
        input: { ...argument },
        stepIndex,
        component,
        kind: step.kind,
        origin:
          step.kind === "translation"
            ? pose.position.clone()
            : frame.position.clone(),
        axis: axes[component]!
      });
    }
  });
  return handles;
}

/**
 * Does any step of the chain read this input, i.e. does editing it move the
 * object at all.
 * @param chain Chain to search.
 * @param input Input to look for.
 */
export function isTransformInputBound(
  chain: TransformChain,
  input: TransformInputRef
): boolean {
  return chain.steps.some(step =>
    step.arguments.some(
      argument =>
        typeof argument !== "number" &&
        argument.group === input.group &&
        argument.component === input.component
    )
  );
}

/**
 * Move an object's origin onto a point by adjusting the first translation step
 * that reads inputs, in place. Slots holding fixed values cannot absorb their
 * share, so such a chain lands the origin only as close as its inputs allow.
 * @param inputs Object's transform inputs, mutated in place.
 * @param chain Chain mapping the inputs onto the pose.
 * @param position Destination, in ASR mm from the object's parent.
 */
export function moveTransformChainOrigin(
  inputs: TransformInputs,
  chain: TransformChain,
  position: [number, number, number]
): void {
  const stepIndex = chain.steps.findIndex(
    step =>
      step.kind === "translation" &&
      step.arguments.some(argument => typeof argument !== "number")
  );
  if (stepIndex < 0) return;

  const { pose, frames } = foldTransformChain(chain, inputs);
  const delta = vector3ToAsr(
    asrToVector3(position)
      .subtractInPlace(pose.position)
      .applyRotationQuaternion(Quaternion.Inverse(frames[stepIndex]!.rotation))
  );

  for (const component of COMPONENTS) {
    const argument = chain.steps[stepIndex]!.arguments[component];
    if (typeof argument === "number") continue;
    inputs[argument.group][argument.component] += delta[component];
  }
}

/**
 * Move an object's origin onto a point along its chain's depth axis alone, in
 * place. False when the chain has no depth axis bound to a translation step,
 * leaving the inputs untouched.
 * @param inputs Object's transform inputs, mutated in place.
 * @param chain Chain mapping the inputs onto the pose.
 * @param position Destination, in ASR mm from the object's parent.
 */
export function moveTransformChainOriginAlongDepth(
  inputs: TransformInputs,
  chain: TransformChain,
  position: [number, number, number]
): boolean {
  const binding = findDepthBinding(chain);
  if (!binding) return false;

  const { pose, frames } = foldTransformChain(chain, inputs);
  const axis = COMPONENT_AXES[binding.component]!.applyRotationQuaternion(
    frames[binding.stepIndex]!.rotation
  );
  const delta = asrToVector3(position).subtractInPlace(pose.position);
  inputs[binding.input.group][binding.input.component] += Vector3.Dot(
    delta,
    axis
  );
  return true;
}

/**
 * Unit ASR direction the chain's depth axis advances the object along, or null
 * when it has no depth axis bound to a translation step.
 * @param chain Chain to resolve the depth axis of.
 * @param inputs Object's twelve transform input values.
 */
export function getTransformChainDepthDirection(
  chain: TransformChain,
  inputs: TransformInputs
): [number, number, number] | null {
  const binding = findDepthBinding(chain);
  if (!binding) return null;

  const { frames } = foldTransformChain(chain, inputs);
  return vector3ToAsr(
    COMPONENT_AXES[binding.component]!.applyRotationQuaternion(
      frames[binding.stepIndex]!.rotation
    )
  );
}

/**
 * Check that a value has the shape of a `TransformChain`.
 * @param value Value to check.
 */
export function isTransformChain(value: unknown): value is TransformChain {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.isBuiltIn === "boolean" &&
    Array.isArray(value.steps) &&
    value.steps.every(isTransformStep) &&
    (value.depthAxis === null || isTransformInputRef(value.depthAxis))
  );
}

/**
 * Check that a value has the shape of a `TransformInputs`.
 * @param value Value to check.
 */
export function isTransformInputs(value: unknown): value is TransformInputs {
  if (!isRecord(value)) return false;

  return TRANSFORM_INPUT_GROUPS.every(group => isFiniteTriple(value[group]));
}

/**
 * Check that a value has the shape of a `TransformInputNames`, with a name for
 * every input.
 * @param value Value to check.
 */
export function isTransformInputNames(
  value: unknown
): value is TransformInputNames {
  if (!isRecord(value)) return false;

  return TRANSFORM_INPUT_GROUPS.every(group => {
    const names = value[group];
    return (
      Array.isArray(names) &&
      names.length === 3 &&
      names.every(name => typeof name === "string" && name.length > 0)
    );
  });
}

/** Build a step whose three arguments read one input group in order. */
function buildInputStep(
  kind: TransformStepKind,
  group: TransformInputGroup
): TransformStep {
  return {
    kind,
    arguments: [
      { group, component: 0 },
      { group, component: 1 },
      { group, component: 2 }
    ]
  };
}

/**
 * Build a rotation step turning one angle alone, its other two fixed at zero,
 * so the step's single ring sits on the axis of the frame it acts in.
 */
function buildAngleStep(
  group: TransformInputGroup,
  component: TransformInputComponent
): TransformStep {
  const argument: TransformArgument = { group, component };
  return {
    kind: "rotation",
    arguments: [
      component === 0 ? argument : 0,
      component === 1 ? argument : 0,
      component === 2 ? argument : 0
    ]
  };
}

/**
 * Fold a chain into the object's pose plus the frame each step acts in.
 * A step reading a global input group acts in the parent frame: it composes
 * outside everything before it, so its axes never move. Every other step acts
 * in the frame its predecessors produced, composing inside them.
 */
function foldTransformChain(
  chain: TransformChain,
  inputs: TransformInputs
): { pose: TransformFrame; frames: TransformFrame[] } {
  let position = Vector3.Zero();
  let rotation = Quaternion.Identity();

  const frames: TransformFrame[] = [];
  for (const step of chain.steps) {
    const isParentFramed = isParentFramedStep(step);
    const frame: TransformFrame = {
      position: position.clone(),
      rotation: isParentFramed ? Quaternion.Identity() : rotation.clone()
    };
    frames.push(frame);

    const [first, second, third] = readStepArguments(step, inputs);
    if (step.kind === "translation") {
      position = new Vector3(third, second, first)
        .applyRotationQuaternion(frame.rotation)
        .addInPlace(position);
      continue;
    }
    const stepRotation = Quaternion.RotationYawPitchRoll(second, third, first);
    rotation = isParentFramed
      ? stepRotation.multiply(rotation)
      : rotation.multiply(stepRotation);
  }

  return { pose: { position, rotation }, frames };
}

/**
 * Does a step act in the object's parent frame rather than the frame its
 * predecessors produced, i.e. does it read a global input group.
 * @param step Step to classify.
 */
function isParentFramedStep(step: TransformStep): boolean {
  return step.arguments.some(
    argument =>
      typeof argument !== "number" && argument.group.startsWith("global")
  );
}

/** Resolve a step's three arguments against the object's inputs. */
function readStepArguments(
  step: TransformStep,
  inputs: TransformInputs
): [number, number, number] {
  return [
    getTransformArgumentValue(step.arguments[0], inputs),
    getTransformArgumentValue(step.arguments[1], inputs),
    getTransformArgumentValue(step.arguments[2], inputs)
  ];
}

/** One argument's value: the input it reads, or its own fixed value. */
function getTransformArgumentValue(
  argument: TransformArgument,
  inputs: TransformInputs
): number {
  return typeof argument === "number"
    ? argument
    : inputs[argument.group][argument.component];
}

/**
 * Frame axis each angle of a rotation step turns the object about. A step's
 * angles nest roll inside pitch inside yaw, so each turns about the axis the
 * angles outside it have already moved - and a step holding one angle alone
 * turns about its frame's own axis, since the others are zero.
 */
function getRotationAxes(
  frame: TransformFrame,
  [, yaw, pitch]: [number, number, number]
): [Vector3, Vector3, Vector3] {
  const afterYaw = frame.rotation.multiply(
    Quaternion.RotationYawPitchRoll(yaw, 0, 0)
  );
  const afterPitch = afterYaw.multiply(
    Quaternion.RotationYawPitchRoll(0, pitch, 0)
  );
  return [
    COMPONENT_AXES[0]!.applyRotationQuaternion(afterPitch),
    COMPONENT_AXES[1]!.applyRotationQuaternion(frame.rotation),
    COMPONENT_AXES[2]!.applyRotationQuaternion(afterYaw)
  ];
}

/** The chain's depth axis resolved to the first translation slot that reads it. */
function findDepthBinding(chain: TransformChain): TransformInputBinding | null {
  const depthAxis = chain.depthAxis;
  if (!depthAxis) return null;

  for (const [stepIndex, step] of chain.steps.entries()) {
    if (step.kind !== "translation") continue;

    for (const component of COMPONENTS) {
      const argument = step.arguments[component];
      if (
        typeof argument !== "number" &&
        argument.group === depthAxis.group &&
        argument.component === depthAxis.component
      ) {
        return { input: { ...argument }, stepIndex, component };
      }
    }
  }
  return null;
}

/** Check that a value has the shape of a `TransformStep`. */
function isTransformStep(value: unknown): value is TransformStep {
  if (!isRecord(value)) return false;

  return (
    (value.kind === "translation" || value.kind === "rotation") &&
    Array.isArray(value.arguments) &&
    value.arguments.length === 3 &&
    value.arguments.every(
      argument => isFiniteNumber(argument) || isTransformInputRef(argument)
    )
  );
}

/** Check that a value has the shape of a `TransformInputRef`. */
function isTransformInputRef(value: unknown): value is TransformInputRef {
  if (!isRecord(value)) return false;

  return (
    typeof value.group === "string" &&
    TRANSFORM_INPUT_GROUPS.includes(value.group as TransformInputGroup) &&
    (value.component === 0 || value.component === 1 || value.component === 2)
  );
}
