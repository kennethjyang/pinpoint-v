/**
 * Which of an object's four transform input groups a value belongs to.
 * Translation groups hold millimeters, rotation groups radians.
 */
export type TransformInputGroup =
  | "globalTranslation"
  | "globalRotation"
  | "localRotation"
  | "localTranslation";

/**
 * Index into an input group's triple. Translation triples are ASR ordered
 * (AP, DV, ML); rotation triples are roll, yaw, pitch, aligned to the same
 * axes.
 */
export type TransformInputComponent = 0 | 1 | 2;

/** Reference to one of an object's twelve transform inputs. */
export interface TransformInputRef {
  group: TransformInputGroup;
  component: TransformInputComponent;
}

/** One argument of a transform step: an input to read, or a fixed value. */
export type TransformArgument = TransformInputRef | number;

/**
 * One translation or rotation a chain applies, in the frame the steps before
 * it produced.
 */
export interface TransformStep {
  kind: TransformStepKind;
  arguments: [TransformArgument, TransformArgument, TransformArgument];
}

/** Whether a step translates or rotates the frame it is applied in. */
export type TransformStepKind = "translation" | "rotation";

/** An ordered series of steps mapping an object's transform inputs onto its pose. */
export interface TransformChain {
  /** Internal unique identifier, referenced by `transformChainId`. */
  id: string;

  /** User-facing name. Empty for built-in chains, which are named from i18n by id. */
  name: string;

  /** Is this a locked, code-defined chain the user can neither edit nor delete. */
  isBuiltIn: boolean;

  /** Steps applied outermost first: step 0 acts in the object's parent frame. */
  steps: TransformStep[];

  /**
   * Input a probe inserts along, used by the move-to-surface march, or null
   * when the chain offers no depth axis.
   */
  depthAxis: TransformInputRef | null;
}

/**
 * An object's twelve transform input values, which its chain maps onto a pose.
 * Translations are in mm, rotations in radians.
 */
export type TransformInputs = Record<
  TransformInputGroup,
  [number, number, number]
>;

/** User-facing name of every transform input, in the same layout as the values. */
export type TransformInputNames = Record<
  TransformInputGroup,
  [string, string, string]
>;
