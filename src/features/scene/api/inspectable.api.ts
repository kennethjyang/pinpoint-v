import { atlasToReferenceRelative, setCameraPose } from "@/features/experiment";
import { setProbeTipMillimeters } from "@/features/probe";
import type { Inspectable } from "../models/inspectable.model";
import type { TransformChain } from "../models/transform-chain.model";
import {
  findTransformChain,
  moveTransformChainOrigin
} from "./transform-chain.api";

/**
 * Is `a` the same inspectable entity as `b`.
 * @param a First entity to compare.
 * @param b Second entity to compare.
 */
export function isSameInspectable(a: Inspectable, b: Inspectable): boolean {
  if (a.inspectableKind !== b.inspectableKind) return false;
  // The scene has exactly one camera and one world, so any two of either match.
  // Checking both narrows `a` and `b` to `Probe | SceneObject` below.
  if (
    a.inspectableKind === "camera" ||
    a.inspectableKind === "world" ||
    b.inspectableKind === "camera" ||
    b.inspectableKind === "world"
  ) {
    return true;
  }
  return a.id === b.id;
}

/**
 * Move an inspectable onto a point in atlas ASR mm: a probe's tip, a scene
 * object's origin, or the camera's orbit target with its orbit left alone.
 * The world has no position, so it is left alone too.
 * @param inspectable Inspectable to move, mutated in place.
 * @param chains Transform chains the moved object's inputs drive.
 * @param atlasMillimeters Destination, in atlas ASR mm.
 * @param referenceCoordinate Experiment reference coordinate, in atlas ASR mm.
 */
export function moveInspectableToMillimeters(
  inspectable: Inspectable,
  chains: readonly TransformChain[],
  atlasMillimeters: [number, number, number],
  referenceCoordinate: [number, number, number]
): void {
  // The world has no position to move.
  if (inspectable.inspectableKind === "world") return;

  if (inspectable.inspectableKind === "camera") {
    setCameraPose(
      inspectable,
      [inspectable.alpha, inspectable.beta, inspectable.radius],
      atlasToReferenceRelative(referenceCoordinate, atlasMillimeters)
    );
    return;
  }

  const chain = findTransformChain(chains, inspectable.transformChainId);
  if (inspectable.inspectableKind === "sceneObject") {
    moveTransformChainOrigin(
      inspectable.transformInputs,
      chain,
      atlasToReferenceRelative(referenceCoordinate, atlasMillimeters)
    );
    return;
  }

  setProbeTipMillimeters(
    inspectable,
    chain,
    atlasMillimeters,
    referenceCoordinate
  );
}
