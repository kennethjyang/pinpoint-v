import type {
  IAxisDragGizmo,
  IPlaneRotationGizmo,
  UtilityLayerRenderer
} from "@babylonjs/core";
import {
  AxisDragGizmo,
  Color3,
  PlaneRotationGizmo,
  Quaternion,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type {
  TransformChain,
  TransformInputComponent,
  TransformInputGroup,
  TransformInputRef,
  TransformInputs,
  TransformStepKind
} from "../models/transform-chain.model";
import type { TransformHandle } from "./transform-chain.api";
import {
  getTransformChainHandles,
  getTransformChainPose
} from "./transform-chain.api";
import { asrToVector3 } from "./coordinate-transforms.api";
import { stopNodePoseInterpolation } from "./pose-interpolation.api";

/** The object a chain gizmo currently drives, and which of its inputs to expose. */
export interface TransformChainGizmoTarget {
  /** Node the resolved pose is written to. Its parent frames the handles. */
  node: TransformNode;

  /** Chain mapping the object's inputs onto its pose. */
  chain: TransformChain;

  /** The object's live transform inputs, written to in place as handles drag. */
  inputs: TransformInputs;

  /** Input group whose handles are shown; the rest of the chain stays hidden. */
  group: TransformInputGroup;
}

/** Callbacks a chain gizmo reports drags through. */
export interface TransformChainGizmoCallbacks {
  /** A handle moved the object, once per drag frame that changed an input. */
  onDrag: () => void;

  /** A handle was released, whether or not the drag moved anything. */
  onDragEnd: () => void;
}

/** One handle of a chain gizmo: the input it drives, drawn by a Babylon gizmo. */
export interface TransformChainGizmoHandle {
  /** Input this handle's drags are added to. */
  input: TransformInputRef;

  /** Step the handle belongs to, and the argument slot it fills. */
  stepIndex: number;
  component: TransformInputComponent;

  kind: TransformStepKind;

  /** Babylon gizmo the handle is drawn and dragged with. */
  gizmo: IAxisDragGizmo | IPlaneRotationGizmo;
}

/**
 * Handles driving one object's transform inputs, rebuilt as the target's chain
 * exposes a different set of them.
 */
export interface TransformChainGizmo {
  /** Handles currently shown, one per chain slot reading the shown input group. */
  readonly handles: readonly TransformChainGizmoHandle[];

  /** Point the handles at an object, or pass null to hide them. */
  setTarget: (target: TransformChainGizmoTarget | null) => void;

  dispose: () => void;
}

/** A handle's gizmo, the throwaway node it is attached to, and its observers. */
interface HandleGizmo extends TransformChainGizmoHandle {
  /** Chain slot the handle fills, so an unchanged set of handles is reused. */
  key: string;
  anchor: TransformNode;
  observers: { remove: () => void }[];
  /** Rotation angle already applied this drag, so each frame adds its own delta. */
  appliedAngle: number;
}

/**
 * Axis every handle is built along, then rotated onto the axis its chain slot
 * actually drives. Babylon bakes a gizmo's axis into its mesh at construction,
 * so the mesh is built once and re-aimed by its anchor's rotation.
 */
const HANDLE_AXIS = new Vector3(1, 0, 0);

/** Handle color per ASR component, matching Babylon's own red X, green Y, blue Z. */
const HANDLE_COLORS: readonly Color3[] = [
  new Color3(0.2, 0.4, 1),
  new Color3(0.2, 0.8, 0.2),
  new Color3(1, 0.25, 0.25)
];

/**
 * Create the transform chain gizmo: a set of drag arrows and rotation rings
 * bound to the chain slots that read the shown input group, each writing its
 * drag straight into that input.
 * @param utilityLayer Layer the handles render in, above the scene.
 * @param callbacks Drag reporting, for drag bookkeeping and undo history.
 */
export function createTransformChainGizmo(
  utilityLayer: UtilityLayerRenderer,
  callbacks: TransformChainGizmoCallbacks
): TransformChainGizmo {
  let target: TransformChainGizmoTarget | null = null;
  let handleGizmos: HandleGizmo[] = [];

  /**
   * Add a handle's drag onto the input it drives and re-pose the object, so the
   * chain - not the gizmo - decides where the object lands.
   */
  function applyDrag(input: TransformInputRef, delta: number): void {
    if (!target || delta === 0) return;

    stopNodePoseInterpolation(target.node);
    target.inputs[input.group][input.component] += delta;

    const { position, rotation } = getTransformChainPose(
      target.chain,
      target.inputs
    );
    target.node.position.copyFrom(asrToVector3(position));
    target.node.rotation.copyFrom(asrToVector3(rotation));
    callbacks.onDrag();
  }

  /** Build one handle's gizmo, aimed by its anchor and wired to its input. */
  function buildHandleGizmo(handle: TransformHandle): HandleGizmo {
    const anchor = new TransformNode(
      `transform_chain_gizmo_anchor_${handle.stepIndex}_${handle.component}`,
      utilityLayer.originalScene
    );
    anchor.rotationQuaternion = Quaternion.Identity();

    const color = HANDLE_COLORS[handle.component]!;
    const handleGizmo: HandleGizmo = {
      key: `${handle.stepIndex}:${handle.component}`,
      input: handle.input,
      stepIndex: handle.stepIndex,
      component: handle.component,
      kind: handle.kind,
      anchor,
      gizmo:
        handle.kind === "translation"
          ? new AxisDragGizmo(HANDLE_AXIS, color, utilityLayer)
          : new PlaneRotationGizmo(HANDLE_AXIS, color, utilityLayer),
      observers: [],
      appliedAngle: 0
    };

    if (handle.kind === "translation") {
      const gizmo = handleGizmo.gizmo as IAxisDragGizmo;
      handleGizmo.observers.push(
        gizmo.dragBehavior.onDragObservable.add(event => {
          applyDrag(handleGizmo.input, event.dragDistance);
        })
      );
    } else {
      const gizmo = handleGizmo.gizmo as IPlaneRotationGizmo;
      handleGizmo.observers.push(
        // The gizmo reports the angle turned since its drag started, so each
        // frame contributes only what the last one did not.
        gizmo.dragBehavior.onDragObservable.add(() => {
          applyDrag(handleGizmo.input, gizmo.angle - handleGizmo.appliedAngle);
          handleGizmo.appliedAngle = gizmo.angle;
        }),
        gizmo.dragBehavior.onDragStartObservable.add(() => {
          handleGizmo.appliedAngle = 0;
        })
      );
    }

    handleGizmo.observers.push(
      handleGizmo.gizmo.dragBehavior.onDragEndObservable.add(() => {
        callbacks.onDragEnd();
      })
    );
    handleGizmo.gizmo.attachedNode = anchor;
    return handleGizmo;
  }

  /** Aim a handle's anchor at the slot's current origin and axis. */
  function aimHandleGizmo(
    handleGizmo: HandleGizmo,
    handle: TransformHandle
  ): void {
    handleGizmo.input = handle.input;
    handleGizmo.anchor.parent = target?.node.parent ?? null;
    handleGizmo.anchor.position.copyFrom(handle.origin);
    Quaternion.FromUnitVectorsToRef(
      HANDLE_AXIS,
      handle.axis,
      handleGizmo.anchor.rotationQuaternion!
    );
  }

  function disposeHandleGizmos(): void {
    for (const handleGizmo of handleGizmos) {
      for (const observer of handleGizmo.observers) observer.remove();
      handleGizmo.gizmo.dispose();
      handleGizmo.anchor.dispose();
    }
    handleGizmos = [];
  }

  return {
    get handles() {
      return handleGizmos;
    },
    setTarget: next => {
      target = next;
      const handles = next
        ? getTransformChainHandles(next.chain, next.inputs).filter(
            handle => handle.input.group === next.group
          )
        : [];

      // A drag rewrites the inputs every frame, so the handles are only rebuilt
      // when the chain exposes a different set of slots - otherwise they are
      // re-aimed in place and keep the drag they are in the middle of.
      const keys = handles
        .map(handle => `${handle.stepIndex}:${handle.component}`)
        .join(",");
      if (keys !== handleGizmos.map(({ key }) => key).join(",")) {
        disposeHandleGizmos();
        handleGizmos = handles.map(buildHandleGizmo);
      }
      handles.forEach((handle, index) => {
        aimHandleGizmo(handleGizmos[index]!, handle);
      });
    },
    dispose: () => {
      disposeHandleGizmos();
      target = null;
    }
  };
}
