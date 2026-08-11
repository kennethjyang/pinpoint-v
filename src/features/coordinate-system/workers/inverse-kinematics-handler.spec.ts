import { describe, expect, it } from "vitest";
import {
  buildCoordinateSystemNode,
  buildCoordinateSystemValue,
  buildFixedCoordinateSystemValue
} from "../api/coordinate-system.api";
import {
  isCoordinateSystemSolutionAtPose,
  solveCoordinateSystemChain
} from "../api/forward-kinematics.api";
import { SETTLED_SOLVE_STARTS } from "../api/inverse-kinematics.api";
import { handleInverseKinematicsMessage } from "./inverse-kinematics-handler";
import type { CoordinateSystemNode } from "../model/coordinate-system.model";

/** Reset every non-fixed value in a chain to zero, mutating it in place. */
function resetFreeValues(chain: CoordinateSystemNode[]): void {
  for (const node of chain) {
    for (const values of [node.position, node.rotation]) {
      for (const value of values) {
        if (!value.fixed) {
          value.value = 0;
        }
      }
    }
  }
}

/** Build the six-free-value node shared by the round-trip fixture, with Pitch bounded. */
function buildFreeNode(): CoordinateSystemNode {
  return buildCoordinateSystemNode(
    "Free",
    [
      buildCoordinateSystemValue("X", null, 10),
      buildCoordinateSystemValue("Y", null, -5),
      buildCoordinateSystemValue("Z", null, 20)
    ],
    [
      buildCoordinateSystemValue("Pitch", [0, Math.PI / 2], 0.3),
      buildCoordinateSystemValue("Yaw", null, 0.5),
      buildCoordinateSystemValue("Roll", null, -0.2)
    ]
  );
}

/** Build the one-free-axis node shared by the round-trip fixture. */
function buildPartlyFreeNode(): CoordinateSystemNode {
  return buildCoordinateSystemNode(
    "Partial",
    [
      buildFixedCoordinateSystemValue("X", 2),
      buildFixedCoordinateSystemValue("Y", 3),
      buildCoordinateSystemValue("Z", null, 7)
    ],
    [
      buildFixedCoordinateSystemValue("Pitch", 0.1),
      buildFixedCoordinateSystemValue("Yaw", 0.2),
      buildFixedCoordinateSystemValue("Roll", 0.3)
    ]
  );
}

describe("handleInverseKinematicsMessage", () => {
  it("solves a request into its reply message, carrying the requestId through and converging", () => {
    const chain = [buildFreeNode(), buildPartlyFreeNode()];
    const solved = solveCoordinateSystemChain(chain, null);
    const target = {
      tipPosition: solved.tipPosition,
      rotation: solved.rotation,
      surfacePosition: null
    };
    resetFreeValues(chain);

    const result = handleInverseKinematicsMessage({
      type: "solveInverseKinematics",
      requestId: 7,
      chain,
      target,
      referenceOffsetMillimeters: null,
      maximumStarts: SETTLED_SOLVE_STARTS
    });

    expect(result.requestId).toBe(7);
    expect(result.status).toBe("converged");
    expect(result.chain).toBe(chain);
    expect(
      isCoordinateSystemSolutionAtPose(
        result.solution,
        target.tipPosition,
        target.rotation,
        1e-4
      )
    ).toBe(true);
  });
});
