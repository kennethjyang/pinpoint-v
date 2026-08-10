import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GizmoManager, IPlaneRotationGizmo, Scene } from "@babylonjs/core";
import { TransformNode, Vector3 } from "@babylonjs/core";
import type { TransformChain, TransformInputs } from "@/features/scene";
import { makeTestSceneWithGizmo } from "@/test/mount-helper";
import { makeTransformChain, makeTransformInputs } from "@/test/fixtures";
import {
  BUILT_IN_TRANSFORM_CHAINS,
  buildTransformInputs,
  getTransformChainPose
} from "./transform-chain.api";
import type { TransformChainGizmo } from "./transform-chain-gizmo.api";
import { createTransformChainGizmo } from "./transform-chain-gizmo.api";

/** The built-in chain every 3D model uses unless told otherwise. */
const DEFAULT_CHAIN = BUILT_IN_TRANSFORM_CHAINS[0]!;

let scene: Scene;
let gizmoManager: GizmoManager;
let gizmo: TransformChainGizmo;
let parent: TransformNode;
let node: TransformNode;
let onDrag: () => void;
let onDragEnd: () => void;

beforeEach(() => {
  ({ scene, gizmoManager } = makeTestSceneWithGizmo());
  onDrag = vi.fn();
  onDragEnd = vi.fn();
  gizmo = createTransformChainGizmo(gizmoManager.utilityLayer, {
    onDrag,
    onDragEnd
  });

  // Mirrors a probe node: parented to the reference coordinate node, which the
  // chain's poses are relative to.
  parent = new TransformNode("reference_coordinate_node", scene);
  parent.position = new Vector3(10, 20, 30);
  node = new TransformNode("probe_node", scene);
  node.parent = parent;
});

/** Drag a translation handle by a signed distance along its own axis. */
function dragArrow(handleIndex: number, dragDistance: number): void {
  const { gizmo: handleGizmo } = gizmo.handles[handleIndex]!;
  handleGizmo.dragBehavior.onDragObservable.notifyObservers({
    delta: Vector3.Zero(),
    dragPlanePoint: Vector3.Zero(),
    dragPlaneNormal: Vector3.Zero(),
    dragDistance,
    pointerId: 1,
    pointerInfo: null
  });
}

/** Turn a rotation handle to an accumulated angle, as its drag frames would. */
function dragRing(handleIndex: number, angle: number): void {
  const handleGizmo = gizmo.handles[handleIndex]!.gizmo as IPlaneRotationGizmo;
  handleGizmo.angle = angle;
  handleGizmo.dragBehavior.onDragObservable.notifyObservers({
    delta: Vector3.Zero(),
    dragPlanePoint: Vector3.Zero(),
    dragPlaneNormal: Vector3.Zero(),
    dragDistance: 0,
    pointerId: 1,
    pointerInfo: null
  });
}

describe("createTransformChainGizmo", () => {
  it("shows one handle per chain slot reading the visible group", () => {
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs: buildTransformInputs(),
      group: "globalTranslation"
    });

    expect(gizmo.handles).toHaveLength(3);
    expect(gizmo.handles.map(({ input }) => input.component)).toEqual([
      0, 1, 2
    ]);
    expect(gizmo.handles.every(({ kind }) => kind === "translation")).toBe(
      true
    );
    expect(
      gizmo.handles.every(({ input }) => input.group === "globalTranslation")
    ).toBe(true);
  });

  it("shows rings for a rotation group", () => {
    gizmo.setTarget({
      node,
      chain: makeTransformChain(),
      inputs: buildTransformInputs(),
      group: "localRotation"
    });

    expect(gizmo.handles).toHaveLength(3);
    expect(gizmo.handles.every(({ kind }) => kind === "rotation")).toBe(true);
  });

  it("shows the default chain's local group a single depth arrow", () => {
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs: buildTransformInputs(),
      group: "localTranslation"
    });

    expect(gizmo.handles).toHaveLength(1);
    expect(gizmo.handles[0]!.input.component).toBe(0);
    expect(gizmo.handles[0]!.kind).toBe("translation");
  });

  it("shows no handle for a slot holding a fixed value", () => {
    const chain: TransformChain = {
      id: "one-axis",
      name: "One axis",
      isBuiltIn: false,
      steps: [
        {
          kind: "translation",
          arguments: [{ group: "globalTranslation", component: 0 }, 0, -1]
        }
      ],
      depthAxis: null
    };

    gizmo.setTarget({
      node,
      chain,
      inputs: buildTransformInputs(),
      group: "globalTranslation"
    });

    expect(gizmo.handles).toHaveLength(1);
    expect(gizmo.handles[0]!.input.component).toBe(0);
  });

  it("hides every handle for a null target", () => {
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs: buildTransformInputs(),
      group: "globalTranslation"
    });
    gizmo.setTarget(null);

    expect(gizmo.handles).toHaveLength(0);
  });

  it("adds an arrow drag onto the input it drives and re-poses the node", () => {
    const inputs = buildTransformInputs();
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalTranslation"
    });

    dragArrow(1, 2.5);

    expect(inputs.globalTranslation).toEqual([0, 2.5, 0]);
    // The node's pose comes from the chain, in its parent's frame.
    expect(node.position.asArray()).toEqual([0, 2.5, 0]);
    expect(onDrag).toHaveBeenCalledOnce();
  });

  it("drives the local translation group through the same arrows", () => {
    const inputs = makeTransformInputs({
      globalTranslation: [1, 0, 0],
      globalRotation: [0, 0, -Math.PI / 2]
    });
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "localTranslation"
    });

    dragArrow(0, 3);

    // A 90 degree pitch turns probe-local up onto atlas DV, so a depth drag
    // moves the tip down DV rather than along AP.
    expect(inputs.localTranslation).toEqual([3, 0, 0]);
    expect(inputs.globalTranslation).toEqual([1, 0, 0]);
    const pose = getTransformChainPose(DEFAULT_CHAIN, inputs);
    expect(pose.position[0]).toBeCloseTo(1, 10);
    expect(pose.position[1]).toBeCloseTo(3, 10);
  });

  it("adds only each frame's own share of a ring's accumulated angle", () => {
    const inputs = buildTransformInputs();
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalRotation"
    });

    dragRing(1, 0.25);
    dragRing(1, 0.4);

    expect(inputs.globalRotation[1]).toBeCloseTo(0.4, 10);
    expect(node.rotation.y).toBeCloseTo(0.4, 10);
    expect(onDrag).toHaveBeenCalledTimes(2);
  });

  it("restarts the ring's accumulation on the next drag", () => {
    const inputs = buildTransformInputs();
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalRotation"
    });

    dragRing(0, 0.3);
    const ring = gizmo.handles[0]!.gizmo as IPlaneRotationGizmo;
    ring.dragBehavior.onDragStartObservable.notifyObservers({
      dragPlanePoint: Vector3.Zero(),
      pointerId: 1,
      pointerInfo: null
    });
    dragRing(0, 0.2);

    // The first global rotation handle is the chain's pitch step.
    expect(inputs.globalRotation[2]).toBeCloseTo(0.5, 10);
  });

  it("keeps the global rotation rings on the world axes while the object turns", () => {
    const inputs = makeTransformInputs({
      globalRotation: [0, 0, Math.PI / 2]
    });
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalRotation"
    });

    const worldAxis = (handleIndex: number) =>
      Vector3.Right().applyRotationQuaternion(
        (gizmo.handles[handleIndex]!.gizmo.attachedNode as TransformNode)
          .rotationQuaternion!
      );

    // Already pitched a quarter turn, and turned further mid-drag: the world
    // DV ring must not follow the probe either time.
    expect(
      worldAxis(1)
        .subtract(new Vector3(0, 1, 0))
        .length()
    ).toBeCloseTo(0, 10);

    dragRing(1, 0.3);
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalRotation"
    });

    expect(
      worldAxis(1)
        .subtract(new Vector3(0, 1, 0))
        .length()
    ).toBeCloseTo(0, 10);
  });

  it("writes a global ring's turn onto its own angle alone", () => {
    const inputs = makeTransformInputs({
      globalRotation: [0, Math.PI / 2, 0]
    });
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalRotation"
    });

    dragRing(0, 0.3);

    // The pitch ring sits on the parent's ML axis whatever the yaw holds, and
    // its drag adds to pitch and nothing else.
    expect(inputs.globalRotation).toEqual([0, Math.PI / 2, 0.3]);
    expect(
      Vector3.Right()
        .applyRotationQuaternion(
          (gizmo.handles[0]!.gizmo.attachedNode as TransformNode)
            .rotationQuaternion!
        )
        .subtract(new Vector3(1, 0, 0))
        .length()
    ).toBeCloseTo(0, 10);
  });

  it("reports a release even when the drag moved nothing", () => {
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs: buildTransformInputs(),
      group: "globalTranslation"
    });

    gizmo.handles[0]!.gizmo.dragBehavior.onDragEndObservable.notifyObservers({
      dragPlanePoint: Vector3.Zero(),
      pointerId: 1,
      pointerInfo: null
    });

    expect(onDragEnd).toHaveBeenCalledOnce();
    expect(onDrag).not.toHaveBeenCalled();
  });

  it("keeps the same handles, and the drag they are in, while the object moves", () => {
    const inputs = buildTransformInputs();
    const target = {
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalTranslation" as const
    };
    gizmo.setTarget(target);
    const before = gizmo.handles.map(({ gizmo: handleGizmo }) => handleGizmo);

    dragArrow(0, 1);
    // Re-aiming after the drag frame is what the scene does every flush.
    gizmo.setTarget(target);

    expect(gizmo.handles.map(({ gizmo: handleGizmo }) => handleGizmo)).toEqual(
      before
    );
  });

  it("rebuilds the handles when the chain exposes a different set of slots", () => {
    const inputs = buildTransformInputs();
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalTranslation"
    });
    const before = gizmo.handles[0]!.gizmo;

    gizmo.setTarget({
      node,
      chain: {
        id: "one-axis",
        name: "One axis",
        isBuiltIn: false,
        steps: [
          {
            kind: "translation",
            arguments: [0, { group: "globalTranslation", component: 1 }, 0]
          }
        ],
        depthAxis: null
      },
      inputs,
      group: "globalTranslation"
    });

    expect(gizmo.handles).toHaveLength(1);
    expect(gizmo.handles[0]!.gizmo).not.toBe(before);
    expect(gizmo.handles[0]!.input.component).toBe(1);
  });

  it("aims a translation handle along its step's frame from the object's origin", () => {
    const inputs = makeTransformInputs({
      globalTranslation: [1, 2, 3],
      globalRotation: [0, Math.PI / 2, 0]
    });
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "localTranslation"
    });

    // Anchors are parented to the object's own parent, so their local pose is
    // the handle's pose in the chain's frame: on the object, yawed with it.
    const anchor = gizmo.handles[0]!.gizmo.attachedNode as TransformNode;
    expect(anchor.parent).toBe(parent);
    expect(anchor.position.asArray()).toEqual([3, 2, 1]);
    expect(
      Vector3.Right()
        .applyRotationQuaternion(anchor.rotationQuaternion!)
        .subtract(new Vector3(1, 0, 0))
        .length()
    ).toBeCloseTo(0, 10);
  });

  it("pivots a rotation handle on its step's frame, not the moved object", () => {
    const inputs = makeTransformInputs({
      globalTranslation: [1, 2, 3],
      localTranslation: [5, 0, 0]
    });
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalRotation"
    });

    const anchor = gizmo.handles[0]!.gizmo.attachedNode as TransformNode;
    expect(anchor.position.asArray()).toEqual([3, 2, 1]);
  });

  it("disposes its handles and anchors", () => {
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs: buildTransformInputs(),
      group: "globalTranslation"
    });

    gizmo.dispose();

    expect(gizmo.handles).toHaveLength(0);
    expect(
      scene.transformNodes.filter(({ name }) =>
        name.startsWith("transform_chain_gizmo_anchor")
      )
    ).toHaveLength(0);
  });

  it("ignores drags once its target is gone", () => {
    const inputs: TransformInputs = buildTransformInputs();
    gizmo.setTarget({
      node,
      chain: DEFAULT_CHAIN,
      inputs,
      group: "globalTranslation"
    });
    const handleGizmo = gizmo.handles[0]!.gizmo;
    gizmo.setTarget(null);

    handleGizmo.dragBehavior.onDragObservable.notifyObservers({
      delta: Vector3.Zero(),
      dragPlanePoint: Vector3.Zero(),
      dragPlaneNormal: Vector3.Zero(),
      dragDistance: 5,
      pointerId: 1,
      pointerInfo: null
    });

    expect(inputs).toEqual(buildTransformInputs());
    expect(onDrag).not.toHaveBeenCalled();
  });
});
