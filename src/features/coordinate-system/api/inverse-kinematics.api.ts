import { Matrix, Quaternion, Vector3 } from "@babylonjs/core";
import { asrToVector3 } from "@/features/scene";
import {
  DOF,
  Goal,
  Joint,
  Link,
  SOLVE_STATUS,
  Solver
} from "./closed-chain-ik";
import {
  getCoordinateSystemAxisEntry,
  getCoordinateSystemAxisValue,
  setCoordinateSystemAxisValue
} from "./coordinate-system.api";
import { solveCoordinateSystemChain } from "./forward-kinematics.api";
import type { IkGoal, IkJoint, IkLink } from "./closed-chain-ik";
import type {
  CoordinateSystemNode,
  CoordinateSystemNodeComponent
} from "../model/coordinate-system.model";

/** Pose an inverse-kinematics solve drives a chain onto, in atlas ASR millimeters and radians. */
export interface CoordinateSystemTarget {
  /** Probe tip, in atlas ASR mm as [ap, dv, ml]. */
  tipPosition: [number, number, number];
  /** Probe rotation as [roll, yaw, pitch], in radians. */
  rotation: [number, number, number];
  /**
   * Point the chain's `onSurface` node must sit at, in atlas ASR mm. Null leaves that node
   * unconstrained.
   */
  surfacePosition: [number, number, number] | null;
}

/** Outcome of an inverse-kinematics solve. */
export type CoordinateSystemSolveStatus =
  | "converged"
  | "stalled"
  | "diverged"
  | "timeout"
  | "noFreeValues";

/** One of a chain's non-fixed values, addressed by node index, component, and axis. */
interface FreeValueBinding {
  nodeIndex: number;
  component: CoordinateSystemNodeComponent;
  axis: number;
}

/** A free value binding paired with the solver joint and DoF actuating it. */
interface SolverBinding extends FreeValueBinding {
  joint: IkJoint;
  dof: number;
}

/** The solver tree built from a chain's current values. */
interface SolverTree {
  root: IkLink;
  nodeLinks: IkLink[];
  bindings: SolverBinding[];
}

/** Restarts for a live solve: the warm seed only, so an unreachable pose stays responsive. */
export const PREVIEW_SOLVE_STARTS = 1;

/** Restarts for a settled solve, enough to escape a bounded local minimum from a cold seed. */
export const SETTLED_SOLVE_STARTS = 6;

/** Rotation axes in the order the chain's `RotationYawPitchRoll` composes them: Y, X, Z. */
const ROTATION_AXIS_ORDER: [number, number, number] = [1, 0, 2];

/** Solver DOF for each rotation axis index. */
const ROTATION_DOF = [DOF.EX, DOF.EY, DOF.EZ];

/** `solve()` calls per start; each call clears the solver's per-solve DOF locks. */
const SOLVE_CALLS_PER_START = 50;

/** Linear-congruential seeding constants, so a failed solve is reproducible. */
const SEED_INITIAL = 0x9e3779b9;
const SEED_MULTIPLIER = 1664525;
const SEED_INCREMENT = 1013904223;

/** Solve-status name for every non-`CONVERGED` solver status. */
const FAILURE_STATUS_NAMES: Record<number, CoordinateSystemSolveStatus> = {
  [SOLVE_STATUS.STALLED]: "stalled",
  [SOLVE_STATUS.DIVERGED]: "diverged",
  [SOLVE_STATUS.TIMEOUT]: "timeout"
};

/**
 * Solve a transform chain's non-fixed values so forward kinematics reproduces a target pose.
 * @param chain Transform chain to solve, mutated in place with the closest result the solver
 * reached even when it does not converge.
 * @param target Pose to solve for.
 * @param referenceOffsetMillimeters Root translation in atlas ASR mm, or null for the atlas origin.
 * @param maximumStarts Re-seeded attempts before the closest result is kept.
 */
export function solveCoordinateSystemChainInverse(
  chain: CoordinateSystemNode[],
  target: CoordinateSystemTarget,
  referenceOffsetMillimeters: [number, number, number] | null,
  maximumStarts: number
): CoordinateSystemSolveStatus {
  const bindings = collectFreeValueBindings(chain);
  if (bindings.length === 0) {
    return "noFreeValues";
  }

  const surfaceIndex = chain.findIndex(node => node.onSurface);
  const useSurfaceGoal = surfaceIndex !== -1 && target.surfacePosition !== null;

  const goalPosition = asrToVector3(target.tipPosition);
  const goalQuaternion = Quaternion.FromRotationMatrix(
    Matrix.RotationYawPitchRoll(
      target.rotation[1],
      target.rotation[2],
      target.rotation[0]
    )
  );

  const seedRandom = createSeedRandom();
  let bestValues: number[] | null = null;
  let bestError = Infinity;
  let lastStatuses: number[] = [];

  for (let start = 0; start < maximumStarts; start++) {
    seedFreeValues(chain, bindings, start, seedRandom);

    const tree = buildSolverTree(chain, referenceOffsetMillimeters);

    const goal: IkGoal = new Goal();
    goal.setPosition(goalPosition.x, goalPosition.y, goalPosition.z);
    goal.setQuaternion(
      goalQuaternion.x,
      goalQuaternion.y,
      goalQuaternion.z,
      goalQuaternion.w
    );
    goal.makeClosure(tree.nodeLinks[tree.nodeLinks.length - 1]!);

    if (useSurfaceGoal) {
      const surfaceGoal: IkGoal = new Goal();
      surfaceGoal.setGoalDoF(DOF.X, DOF.Y, DOF.Z);
      const surfacePosition = asrToVector3(target.surfacePosition!);
      surfaceGoal.setPosition(
        surfacePosition.x,
        surfacePosition.y,
        surfacePosition.z
      );
      surfaceGoal.makeClosure(tree.nodeLinks[surfaceIndex]!);
    }

    const solver = new Solver([tree.root]);
    solver.maxIterations = 100;
    solver.stallThreshold = 1e-8;
    solver.divergeThreshold = 0.01;
    solver.translationConvergeThreshold = 1e-5;
    solver.rotationConvergeThreshold = 1e-6;
    solver.useSVD = false;
    solver.restPoseFactor = 0;

    const seedError = getTargetError(
      chain,
      target,
      referenceOffsetMillimeters,
      surfaceIndex
    );
    if (seedError < bestError) {
      bestError = seedError;
      bestValues = bindings.map(binding =>
        getCoordinateSystemAxisValue(
          chain[binding.nodeIndex]!,
          binding.component,
          binding.axis
        )
      );
    }

    for (let call = 0; call < SOLVE_CALLS_PER_START; call++) {
      const statuses = solver.solve();
      for (const binding of tree.bindings) {
        setCoordinateSystemAxisValue(
          chain[binding.nodeIndex]!,
          binding.component,
          binding.axis,
          binding.joint.getDoFValue(binding.dof)
        );
      }
      lastStatuses = statuses;

      const error = getTargetError(
        chain,
        target,
        referenceOffsetMillimeters,
        surfaceIndex
      );
      if (error < bestError) {
        bestError = error;
        bestValues = bindings.map(binding =>
          getCoordinateSystemAxisValue(
            chain[binding.nodeIndex]!,
            binding.component,
            binding.axis
          )
        );
      }

      if (statuses.every(status => status === SOLVE_STATUS.CONVERGED)) {
        return "converged";
      }
    }
  }

  for (let index = 0; index < bindings.length; index++) {
    const binding = bindings[index]!;
    setCoordinateSystemAxisValue(
      chain[binding.nodeIndex]!,
      binding.component,
      binding.axis,
      bestValues![index]!
    );
  }
  return mapSolveStatuses(lastStatuses);
}

/**
 * Collect every non-fixed value in a chain as a binding to its node, component, and axis.
 * @param chain Transform chain to scan.
 */
function collectFreeValueBindings(
  chain: CoordinateSystemNode[]
): FreeValueBinding[] {
  const bindings: FreeValueBinding[] = [];
  for (let nodeIndex = 0; nodeIndex < chain.length; nodeIndex++) {
    const node = chain[nodeIndex]!;
    for (const component of ["position", "rotation"] as const) {
      for (let axis = 0; axis < 3; axis++) {
        if (!getCoordinateSystemAxisEntry(node, component, axis).fixed) {
          bindings.push({ nodeIndex, component, axis });
        }
      }
    }
  }
  return bindings;
}

/**
 * Seed a chain's free values for one solve start: the incoming values, each bound's midpoint (or
 * zero when unbounded), or a random in-bounds value (or zero when unbounded).
 * @param chain Transform chain to seed, mutated in place.
 * @param bindings Free value bindings to seed.
 * @param start Index of the solve start, selecting the seeding strategy.
 * @param random Seeded random source for restarts beyond the midpoint start.
 */
function seedFreeValues(
  chain: CoordinateSystemNode[],
  bindings: FreeValueBinding[],
  start: number,
  random: () => number
): void {
  if (start === 0) {
    return;
  }
  for (const binding of bindings) {
    const node = chain[binding.nodeIndex]!;
    const entry = getCoordinateSystemAxisEntry(
      node,
      binding.component,
      binding.axis
    );
    let value = 0;
    if (entry.bounds) {
      const [lower, upper] = entry.bounds;
      value =
        start === 1 ? (lower + upper) / 2 : lower + random() * (upper - lower);
    }
    setCoordinateSystemAxisValue(node, binding.component, binding.axis, value);
  }
}

/**
 * Map a solve's per-chain statuses onto its first failure, or timeout when every entry
 * converged or none were produced.
 * @param statuses Statuses returned by the solver's last `solve()` call.
 */
function mapSolveStatuses(statuses: number[]): CoordinateSystemSolveStatus {
  for (const status of statuses) {
    if (status !== SOLVE_STATUS.CONVERGED) {
      return FAILURE_STATUS_NAMES[status] ?? "timeout";
    }
  }
  return "timeout";
}

/**
 * Build the solver tree reproducing a chain's forward kinematics: a translation joint then one
 * single-axis rotation joint per axis in Y, X, Z order, per node.
 * @param chain Transform chain to mirror.
 * @param referenceOffsetMillimeters Root translation in atlas ASR mm, or null for the atlas origin.
 */
function buildSolverTree(
  chain: CoordinateSystemNode[],
  referenceOffsetMillimeters: [number, number, number] | null
): SolverTree {
  const root: IkLink = new Link();
  if (referenceOffsetMillimeters) {
    const offset = asrToVector3(referenceOffsetMillimeters);
    root.setPosition(offset.x, offset.y, offset.z);
  }

  const nodeLinks: IkLink[] = [];
  const bindings: SolverBinding[] = [];
  let parentLink: IkLink = root;

  for (let nodeIndex = 0; nodeIndex < chain.length; nodeIndex++) {
    const node = chain[nodeIndex]!;

    const translationJoint: IkJoint = new Joint();
    const freeTranslationAxes: number[] = [];
    const fixedPosition: [number, number, number] = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      const entry = getCoordinateSystemAxisEntry(node, "position", axis);
      if (entry.fixed) {
        fixedPosition[axis] = entry.value;
      } else {
        freeTranslationAxes.push(axis);
      }
    }
    translationJoint.setPosition(...fixedPosition);
    if (freeTranslationAxes.length > 0) {
      translationJoint.setDoF(...freeTranslationAxes);
      translationJoint.setDoFValues(
        ...freeTranslationAxes.map(axis =>
          getCoordinateSystemAxisValue(node, "position", axis)
        )
      );
      for (const axis of freeTranslationAxes) {
        const entry = getCoordinateSystemAxisEntry(node, "position", axis);
        if (entry.bounds) {
          translationJoint.setMinLimit(axis, entry.bounds[0]);
          translationJoint.setMaxLimit(axis, entry.bounds[1]);
        }
        bindings.push({
          nodeIndex,
          component: "position",
          axis,
          joint: translationJoint,
          dof: axis
        });
      }
    }
    parentLink.addChild(translationJoint);
    let currentLink: IkLink = new Link();
    translationJoint.addChild(currentLink);

    for (const axis of ROTATION_AXIS_ORDER) {
      const entry = getCoordinateSystemAxisEntry(node, "rotation", axis);
      const rotationJoint: IkJoint = new Joint();
      if (entry.fixed) {
        const half = entry.value / 2;
        const quaternion: [number, number, number, number] = [
          0,
          0,
          0,
          Math.cos(half)
        ];
        quaternion[axis] = Math.sin(half);
        rotationJoint.setQuaternion(...quaternion);
      } else {
        const dof = ROTATION_DOF[axis]!;
        rotationJoint.setDoF(dof);
        rotationJoint.setDoFValues(
          getCoordinateSystemAxisValue(node, "rotation", axis)
        );
        if (entry.bounds) {
          rotationJoint.setMinLimit(dof, entry.bounds[0]);
          rotationJoint.setMaxLimit(dof, entry.bounds[1]);
        }
        bindings.push({
          nodeIndex,
          component: "rotation",
          axis,
          joint: rotationJoint,
          dof
        });
      }
      currentLink.addChild(rotationJoint);
      const nextLink: IkLink = new Link();
      rotationJoint.addChild(nextLink);
      currentLink = nextLink;
    }

    nodeLinks.push(currentLink);
    parentLink = currentLink;
  }

  return { root, nodeLinks, bindings };
}

/**
 * Score a chain's current values against a target pose and surface point as a mixed-unit sum of
 * position, orientation, and surface error, used only to pick the best solve attempt.
 * @param chain Transform chain to score.
 * @param target Pose being solved for.
 * @param referenceOffsetMillimeters Root translation in atlas ASR mm, or null for the atlas origin.
 * @param surfaceIndex Index of the chain's surface node, or -1 when there is none.
 */
function getTargetError(
  chain: CoordinateSystemNode[],
  target: CoordinateSystemTarget,
  referenceOffsetMillimeters: [number, number, number] | null,
  surfaceIndex: number
): number {
  const solution = solveCoordinateSystemChain(
    chain,
    referenceOffsetMillimeters
  );

  let error = Vector3.Distance(
    asrToVector3(solution.tipPosition),
    asrToVector3(target.tipPosition)
  );

  const targetRotation = Quaternion.FromRotationMatrix(
    Matrix.RotationYawPitchRoll(
      target.rotation[1],
      target.rotation[2],
      target.rotation[0]
    )
  );
  const solvedRotation = Quaternion.FromRotationMatrix(
    Matrix.RotationYawPitchRoll(
      solution.rotation[1],
      solution.rotation[2],
      solution.rotation[0]
    )
  );
  error +=
    2 *
    Math.acos(
      Math.min(1, Math.abs(Quaternion.Dot(solvedRotation, targetRotation)))
    );

  if (surfaceIndex !== -1 && target.surfacePosition !== null) {
    error += Vector3.Distance(
      asrToVector3(solution.nodePositions[surfaceIndex]!),
      asrToVector3(target.surfacePosition)
    );
  }

  return error;
}

/**
 * Build a reproducible linear-congruential random source for re-seeding failed solve starts.
 */
function createSeedRandom(): () => number {
  let state = SEED_INITIAL;
  return () => {
    state = (Math.imul(state, SEED_MULTIPLIER) + SEED_INCREMENT) >>> 0;
    return state / 0x100000000;
  };
}
