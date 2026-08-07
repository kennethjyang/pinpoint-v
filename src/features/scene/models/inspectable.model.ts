import type { Probe } from "@/features/probe";
import type { CameraInspectable } from "./camera-inspectable.model";
import type { SceneObject } from "./scene-object.model";

export type InspectableKind = "probe" | "camera" | "sceneObject";
export type Inspectable = Probe | CameraInspectable | SceneObject;
