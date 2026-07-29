import type { Scene } from "@babylonjs/core";
import { TransformNode, Vector3 } from "@babylonjs/core";
import type { Experiment } from "@/features/experiment";
import { buildAtlasRootNode } from "./structures.api";

const REFERENCE_COORDINATE_NODE_NAME = "referenceCoordinate_node";

/**
 * Build the reference coordinate node or return the existing one.
 * @param scene Scene to get or add the reference coordinate node.
 * @param experiment Experiment to base the reference coordinate location on.
 */
export function buildReferenceCoordinateNode(
  scene: Scene,
  experiment: Experiment
): TransformNode {
  // Get the existing node or create it and add it to the atlas root.
  const atlasRootNode = buildAtlasRootNode(scene);
  const referenceCoordinateNodeCandidates = atlasRootNode.getChildren(
    node => node.name === REFERENCE_COORDINATE_NODE_NAME
  );
  let referenceCoordinateNode =
    referenceCoordinateNodeCandidates.length === 1
      ? (referenceCoordinateNodeCandidates[0] as TransformNode)
      : null;
  if (!referenceCoordinateNode) {
    referenceCoordinateNode = new TransformNode(
      REFERENCE_COORDINATE_NODE_NAME,
      scene
    );
    referenceCoordinateNode.parent = atlasRootNode;
  }

  // Set position to experiment preference.
  referenceCoordinateNode.setPositionWithLocalVector(
    new Vector3(
      experiment.referenceCoordinate[0],
      experiment.referenceCoordinate[1],
      experiment.referenceCoordinate[2]
    )
  );

  return referenceCoordinateNode;
}
