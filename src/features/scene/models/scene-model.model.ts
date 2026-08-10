import type { TransformInputs } from "./transform-chain.model";

/**
 * An arbitrary 3D model's placement. Its `id` doubles as the key of the model's
 * file bytes in IndexedDB.
 */
export interface SceneModel {
  /** Internal unique identifier, and the IndexedDB key of the model's file. A UUID, not user facing. */
  id: string;

  /**
   * Transform chain the model's inputs are applied through, by id. Falls back
   * to the built-in default chain when the id names no chain the user has.
   */
  transformChainId: string;

  /**
   * The twelve values the model's transform chain maps onto its pose:
   * translations in mm, rotations in radians. Triples are ASR ordered - AP,
   * DV, ML for translations, roll, yaw, pitch for rotations - relative to the
   * experiment reference coordinate for a scene object, and to the probe's
   * transform node for a probe body model.
   */
  transformInputs: TransformInputs;

  /**
   * Internal scale representation of the model.
   * - Scene objects: AP, DV, ML order, ASR orientation.
   * - Probe body models: Babylon local X, Y, Z.
   * - Unitless multiplier; 1 is the model's own size.
   */
  scale: [number, number, number];
}
