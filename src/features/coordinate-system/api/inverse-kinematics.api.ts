// Deep-import to avoid the side-effectful root barrel, which would drag the whole Babylon engine into this solver's worker chunk.
import { Matrix, Quaternion } from "@babylonjs/core/Maths/math.vector";
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

/** One of a chain's free values, addressed by node index, component, and axis. */
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

/** Closest pose one solve has reached, shared across its passes. */
interface SolvePassBest {
  error: number;
  values: number[];
  statuses: number[];
}

/** One solver pass over a chain: which nodes may move, its budget, and the shared best pose. */
interface SolvePassOptions {
  bindings: FreeValueBinding[];
  incomingValues: number[];
  goalQuaternion: Quaternion;
  surfaceIndex: number;
  useSurfaceGoal: boolean;
  /** Highest node index whose free values may move; free values past it are held at zero. */
  activeNodeLimit: number;
  maximumStarts: number;
  solveCalls: number;
  best: SolvePassBest;
}

/** Restarts for a live solve: the warm seed only, so an unreachable pose stays responsive. */
export const PREVIEW_SOLVE_STARTS = 1;

/** Restarts for a settled solve, enough to escape a local minimum from a cold seed. */
export const SETTLED_SOLVE_STARTS = 6;

/** Rotation axes in the order the chain's `RotationYawPitchRoll` composes them: Y, X, Z. */
const ROTATION_AXIS_ORDER: [number, number, number] = [1, 0, 2];

/** Solver DOF for each rotation axis index. */
const ROTATION_DOF = [DOF.EX, DOF.EY, DOF.EZ];

/** `solve()` calls per start; each call clears the solver's per-solve DOF locks. */
const SOLVE_CALLS_PER_START = 50;

/** `solve()` calls one earlier-node stage gets before the full-chain pass takes over. */
const STAGE_SOLVE_CALLS = 5;

/** Degrees of freedom the tip goal constrains, so the fewest a stage needs to pose a chain alone. */
const POSE_GOAL_DOF_COUNT = 6;

/** Spread of the random restart seed for a position value, in millimeters. */
const POSITION_SEED_SPREAD_MILLIMETERS = 10;

/** Spread of the random restart seed for a rotation value, in radians. */
const ROTATION_SEED_SPREAD_RADIANS = Math.PI;

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
 * Solve a transform chain's free values so forward kinematics reproduces a target pose, preferring the earliest nodes that can reach it alone and leaving the free values past them at zero.
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
  const goalQuaternion = Quaternion.FromRotationMatrix(
    Matrix.RotationYawPitchRoll(
      target.rotation[1],
      target.rotation[2],
      target.rotation[0]
    )
  );
  // The incoming values are the fallback best, so a solve with no starts -- or one whose every
  // error evaluation is NaN -- still writes back a well-defined chain.
  const incomingValues = snapshotFreeValues(chain, bindings);
  const best: SolvePassBest = {
    error: Infinity,
    values: [...incomingValues],
    statuses: []
  };

  // A pinned surface node leaves the nodes past it as the only way to reach the tip, so there is no
  // redundancy to hand back to the earlier ones.
  const stageLimits = useSurfaceGoal ? [] : collectStageNodeLimits(bindings);
  for (const activeNodeLimit of stageLimits) {
    const staged = runSolvePass(chain, target, referenceOffsetMillimeters, {
      bindings,
      incomingValues,
      goalQuaternion,
      surfaceIndex,
      useSurfaceGoal,
      activeNodeLimit,
      maximumStarts: 1,
      solveCalls: STAGE_SOLVE_CALLS,
      best
    });
    if (staged === "converged") return "converged";
  }

  const status = runSolvePass(chain, target, referenceOffsetMillimeters, {
    bindings,
    incomingValues,
    goalQuaternion,
    surfaceIndex,
    useSurfaceGoal,
    activeNodeLimit: chain.length - 1,
    maximumStarts,
    solveCalls: SOLVE_CALLS_PER_START,
    best
  });
  if (status === "converged") return "converged";

  for (let index = 0; index < bindings.length; index++) {
    const binding = bindings[index]!;
    setCoordinateSystemAxisValue(
      chain[binding.nodeIndex]!,
      binding.component,
      binding.axis,
      best.values[index]!
    );
  }
  return mapSolveStatuses(best.statuses);
}

/**
 * Run one solver pass over a chain, keeping the closest pose it reaches in `options.best`.
 * @param chain Transform chain to solve, mutated in place.
 * @param target Pose to solve for.
 * @param referenceOffsetMillimeters Root translation in atlas ASR mm, or null for the atlas origin.
 * @param options Which nodes may move, the pass's budget, and the shared best pose.
 */
function runSolvePass(
  chain: CoordinateSystemNode[],
  target: CoordinateSystemTarget,
  referenceOffsetMillimeters: [number, number, number] | null,
  options: SolvePassOptions
): "converged" | null {
  const {
    bindings,
    incomingValues,
    goalQuaternion,
    surfaceIndex,
    useSurfaceGoal,
    activeNodeLimit,
    best
  } = options;
  const [targetAp, targetDv, targetMl] = target.tipPosition;
  const seedRandom = createSeedRandom();

  for (let start = 0; start < options.maximumStarts; start++) {
    seedFreeValues(
      chain,
      bindings,
      start,
      seedRandom,
      incomingValues,
      activeNodeLimit
    );

    const tree = buildSolverTree(
      chain,
      referenceOffsetMillimeters,
      activeNodeLimit
    );

    const goal: IkGoal = new Goal();
    goal.setPosition(targetMl, targetDv, targetAp);
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
      const [surfaceAp, surfaceDv, surfaceMl] = target.surfacePosition!;
      surfaceGoal.setPosition(surfaceMl, surfaceDv, surfaceAp);
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
      surfaceIndex,
      goalQuaternion
    );
    if (seedError < best.error) {
      best.error = seedError;
      best.values = snapshotFreeValues(chain, bindings);
    }

    for (let call = 0; call < options.solveCalls; call++) {
      const statuses = solver.solve();
      for (const binding of tree.bindings) {
        setCoordinateSystemAxisValue(
          chain[binding.nodeIndex]!,
          binding.component,
          binding.axis,
          binding.joint.getDoFValue(binding.dof)
        );
      }

      const error = getTargetError(
        chain,
        target,
        referenceOffsetMillimeters,
        surfaceIndex,
        goalQuaternion
      );
      if (error < best.error) {
        best.error = error;
        best.statuses = statuses;
        best.values = snapshotFreeValues(chain, bindings);
      }

      if (statuses.every(status => status === SOLVE_STATUS.CONVERGED)) {
        return "converged";
      }
    }
  }
  return null;
}

/**
 * Collect every free value in a chain as a binding to its node, component, and axis.
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
        if (
          getCoordinateSystemAxisEntry(node, component, axis).mode === "free"
        ) {
          bindings.push({ nodeIndex, component, axis });
        }
      }
    }
  }
  return bindings;
}

/**
 * Node indices to stage a solve at: the last node of each chain prefix holding enough free values
 * to pose the chain alone. The final node never qualifies, since the full-chain pass covers it.
 * @param bindings Free value bindings, grouped by ascending node index.
 */
function collectStageNodeLimits(bindings: FreeValueBinding[]): number[] {
  const limits: number[] = [];
  for (let index = 0; index < bindings.length - 1; index++) {
    if (bindings[index]!.nodeIndex === bindings[index + 1]!.nodeIndex) continue;
    if (index + 1 >= POSE_GOAL_DOF_COUNT)
      limits.push(bindings[index]!.nodeIndex);
  }
  return limits;
}

/**
 * Read every free value a chain's bindings address, index-aligned with them.
 * @param chain Transform chain to read.
 * @param bindings Free value bindings to read.
 */
function snapshotFreeValues(
  chain: CoordinateSystemNode[],
  bindings: FreeValueBinding[]
): number[] {
  return bindings.map(binding =>
    getCoordinateSystemAxisValue(
      chain[binding.nodeIndex]!,
      binding.component,
      binding.axis
    )
  );
}

/**
 * Seed a chain's free values for one solve start: the incoming values restored, zero, or a
 * random value centered on the incoming one.
 * @param chain Transform chain to seed, mutated in place.
 * @param bindings Free value bindings to seed.
 * @param start Index of the solve start, selecting the seeding strategy.
 * @param random Seeded random source for restarts beyond the zero start.
 * @param incomingValues Each binding's value before this solve began, restored at `start === 0`
 * and used as the restart center from `start >= 2`.
 * @param activeNodeLimit Highest node index whose free values may move; free values past it are
 * seeded to zero.
 */
function seedFreeValues(
  chain: CoordinateSystemNode[],
  bindings: FreeValueBinding[],
  start: number,
  random: () => number,
  incomingValues: number[],
  activeNodeLimit: number
): void {
  for (let index = 0; index < bindings.length; index++) {
    const binding = bindings[index]!;
    const node = chain[binding.nodeIndex]!;
    let value: number;
    if (binding.nodeIndex > activeNodeLimit) {
      value = 0;
    } else if (start === 0) {
      value = incomingValues[index]!;
    } else if (start === 1) {
      value = 0;
    } else {
      const spread =
        binding.component === "position"
          ? POSITION_SEED_SPREAD_MILLIMETERS
          : ROTATION_SEED_SPREAD_RADIANS;
      value = incomingValues[index]! + (random() * 2 - 1) * spread;
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
 * @param activeNodeLimit Highest node index whose free values may move; free values past it are
 * baked as fixed.
 */
function buildSolverTree(
  chain: CoordinateSystemNode[],
  referenceOffsetMillimeters: [number, number, number] | null,
  activeNodeLimit: number
): SolverTree {
  const root: IkLink = new Link();
  if (referenceOffsetMillimeters) {
    const [offsetAp, offsetDv, offsetMl] = referenceOffsetMillimeters;
    root.setPosition(offsetMl, offsetDv, offsetAp);
  }

  const nodeLinks: IkLink[] = [];
  const bindings: SolverBinding[] = [];
  let parentLink: IkLink = root;

  for (let nodeIndex = 0; nodeIndex < chain.length; nodeIndex++) {
    const node = chain[nodeIndex]!;
    // An inactive free value was seeded to zero, so baking its current value freezes it there.
    const isNodeActive = nodeIndex <= activeNodeLimit;

    const translationJoint: IkJoint = new Joint();
    const freeTranslationAxes: number[] = [];
    const fixedPosition: [number, number, number] = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      const entry = getCoordinateSystemAxisEntry(node, "position", axis);
      if (entry.mode === "free" && isNodeActive) {
        freeTranslationAxes.push(axis);
      } else {
        fixedPosition[axis] = entry.value;
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
      if (entry.mode !== "free" || !isNodeActive) {
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
 * @param targetRotation Target pose's rotation as a quaternion, precomputed once per solve.
 */
function getTargetError(
  chain: CoordinateSystemNode[],
  target: CoordinateSystemTarget,
  referenceOffsetMillimeters: [number, number, number] | null,
  surfaceIndex: number,
  targetRotation: Quaternion
): number {
  const solution = solveCoordinateSystemChain(
    chain,
    referenceOffsetMillimeters
  );

  let error = getAsrDistance(solution.tipPosition, target.tipPosition);

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
    error += getAsrDistance(
      solution.nodePositions[surfaceIndex]!,
      target.surfacePosition
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

/**
 * Euclidean distance between two atlas ASR millimeter triples.
 * @param a First triple, as [ap, dv, ml].
 * @param b Second triple, as [ap, dv, ml].
 */
function getAsrDistance(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const deltaAp = a[0] - b[0];
  const deltaDv = a[1] - b[1];
  const deltaMl = a[2] - b[2];
  return Math.sqrt(deltaMl * deltaMl + deltaDv * deltaDv + deltaAp * deltaAp);
}
