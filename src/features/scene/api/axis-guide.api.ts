import { Color3, Matrix, TransformNode } from "@babylonjs/core";
import type { Color4, IMatrixLike, Scene } from "@babylonjs/core";
import { FontAsset, SdfTextParagraph, TextRenderer } from "@babylonjs/addons";
import type { INodeLike, ParagraphOptions } from "@babylonjs/addons";
import axios from "axios";
import type { Manifest } from "@/features/atlas";
import { getAtlasDimensionsMillimeters } from "@/features/atlas";
import { asrToBabylon } from "./coordinate-transforms.api";

/** Atlas axis an axis guide marks. */
export type AxisGuideAxis = "ap" | "dv" | "ml";

/** MSDF text renderer surface the axis guides drive. */
export interface AxisGuideTextRenderer {
  parent: INodeLike | null;
  addParagraph(
    text: string,
    options?: Partial<ParagraphOptions>,
    worldMatrix?: IMatrixLike
  ): void;
  clearParagraphs(): void;
}

/** Text renderers and font asset the axis guide labels are drawn with. */
export interface AxisGuides {
  renderers: Record<AxisGuideAxis, AxisGuideTextRenderer>;
  fontAsset: FontAsset;
  /** Release the renderers, the font asset, and the per-frame draw hook. */
  dispose: () => void;
}

/** One axis guide: which axis, which end, its label, and its orientation. */
interface AxisGuideSpec {
  axis: AxisGuideAxis;
  sign: 1 | -1;
  text: string;
  /** Euler rotation in radians, in Babylon's yaw-pitch-roll order. */
  rotation: { pitch: number; yaw: number; roll: number };
}

const AXIS_GUIDE_ROOT_NODE_NAME = "axisGuideRoot_node";

/** Babylon's Roboto MSDF font definition and its glyph atlas. */
const AXIS_GUIDE_FONT_DEFINITION_URL =
  "https://assets.babylonjs.com/fonts/roboto-regular.json";
const AXIS_GUIDE_FONT_TEXTURE_URL =
  "https://assets.babylonjs.com/fonts/roboto-regular.png";

/** Index of each axis in an ASR coordinate triple. */
const AXIS_GUIDE_ASR_INDEX: Record<AxisGuideAxis, 0 | 1 | 2> = {
  ap: 0,
  dv: 1,
  ml: 2
};

/** Label colour per axis: AP blue, DV green, ML red (Babylon's gizmo axes). */
const AXIS_GUIDE_COLORS: Record<AxisGuideAxis, Color4> = {
  ap: Color3.Blue().toColor4(),
  dv: Color3.Green().toColor4(),
  ml: Color3.Red().toColor4()
};

/**
 * The six guides. MSDF text is legible from its local -Z side, with local +X
 * its reading direction and local +Y its top edge: a quarter-turn pitch lays
 * the AP and ML labels flat in the AP/ML plane facing -DV (world +Y), where
 * yaw turns each label's top edge towards its own signed axis; the DV labels
 * stay upright in the DV/ML plane, facing +AP (world -Z) with their top edge
 * already towards -DV.
 */
const AXIS_GUIDE_SPECS: AxisGuideSpec[] = [
  {
    axis: "ap",
    sign: 1,
    text: "+AP",
    rotation: { pitch: Math.PI / 2, yaw: Math.PI, roll: 0 }
  },
  {
    axis: "ap",
    sign: -1,
    text: "-AP",
    rotation: { pitch: Math.PI / 2, yaw: 0, roll: 0 }
  },
  {
    axis: "dv",
    sign: 1,
    text: "+DV",
    rotation: { pitch: 0, yaw: 0, roll: 0 }
  },
  {
    axis: "dv",
    sign: -1,
    text: "-DV",
    rotation: { pitch: 0, yaw: 0, roll: 0 }
  },
  {
    axis: "ml",
    sign: 1,
    text: "+ML",
    rotation: { pitch: Math.PI / 2, yaw: Math.PI / 2, roll: 0 }
  },
  {
    axis: "ml",
    sign: -1,
    text: "-ML",
    rotation: { pitch: Math.PI / 2, yaw: -Math.PI / 2, roll: 0 }
  }
];

/** Widest label's width, as a fraction of the atlas's ML length. */
const AXIS_GUIDE_WIDTH_ML_FRACTION = 0.5;

/**
 * Load the MSDF font and create one text renderer per axis, drawn after every
 * frame of the scene. Rejects, leaving nothing behind, if the font definition
 * cannot be fetched or the renderers cannot be created.
 * @param scene Scene the renderers draw in.
 */
export async function createAxisGuides(scene: Scene): Promise<AxisGuides> {
  const definition = await axios.get<string>(AXIS_GUIDE_FONT_DEFINITION_URL, {
    responseType: "text"
  });
  const fontAsset = new FontAsset(
    definition.data,
    AXIS_GUIDE_FONT_TEXTURE_URL,
    scene
  );

  let renderers: Record<AxisGuideAxis, TextRenderer>;
  try {
    const [ap, dv, ml] = await Promise.all([
      createTextRenderer(scene, fontAsset, AXIS_GUIDE_COLORS.ap),
      createTextRenderer(scene, fontAsset, AXIS_GUIDE_COLORS.dv),
      createTextRenderer(scene, fontAsset, AXIS_GUIDE_COLORS.ml)
    ]);
    renderers = { ap, dv, ml };
  } catch (error) {
    fontAsset.dispose();
    throw error;
  }

  // Text renderers are not scene nodes, so Babylon never draws them: render
  // each one after the scene with the active camera's matrices.
  const observer = scene.onAfterRenderObservable.add(() => {
    const camera = scene.activeCamera;
    if (!camera) return;

    for (const renderer of Object.values(renderers)) {
      renderer.render(camera.getViewMatrix(), camera.getProjectionMatrix());
    }
  });

  return {
    renderers,
    fontAsset,
    dispose: () => {
      observer.remove();
      for (const renderer of Object.values(renderers)) renderer.dispose();
      fontAsset.dispose();
    }
  };
}

/**
 * Rebuild the atlas's six axis guide labels, replacing any existing ones.
 * @param scene Scene holding the axis guide root node.
 * @param guides Text renderers and font asset to draw the labels with.
 * @param manifest Manifest supplying the atlas's dimensions.
 */
export function buildAxisGuides(
  scene: Scene,
  guides: AxisGuides,
  manifest: Manifest
): void {
  removeAxisGuides(scene, guides);

  const dimensions = getAtlasDimensionsMillimeters(manifest);
  const mlLength = dimensions[AXIS_GUIDE_ASR_INDEX.ml];
  if (mlLength === 0) return;

  // `setAtlasCenterOffset` keeps the atlas center on the scene origin, so the
  // guides are placed straight in world space around that origin.
  const root = new TransformNode(AXIS_GUIDE_ROOT_NODE_NAME, scene);
  const fontSize = axisGuideFontSize(mlLength, guides.fontAsset);

  for (const spec of AXIS_GUIDE_SPECS) {
    const renderer = guides.renderers[spec.axis];
    renderer.parent = root;
    renderer.addParagraph(
      spec.text,
      undefined,
      axisGuideMatrix(spec, dimensions, fontSize)
    );
  }
}

/**
 * Create one colored MSDF text renderer.
 * @param scene Scene supplying the engine the renderer compiles against.
 * @param fontAsset Font asset the renderer draws with.
 * @param color Color the renderer draws its text in.
 */
async function createTextRenderer(
  scene: Scene,
  fontAsset: FontAsset,
  color: Color4
): Promise<TextRenderer> {
  const renderer = await TextRenderer.CreateTextRendererAsync(
    fontAsset,
    scene.getEngine()
  );
  renderer.color = color;
  return renderer;
}

/**
 * Dispose the axis guide root node and clear every label, if built.
 * @param scene Scene to remove the axis guide root node from.
 * @param guides Text renderers to clear the labels from.
 */
function removeAxisGuides(scene: Scene, guides: AxisGuides): void {
  scene.getTransformNodeByName(AXIS_GUIDE_ROOT_NODE_NAME)?.dispose();
  for (const renderer of Object.values(guides.renderers)) {
    renderer.clearParagraphs();
    renderer.parent = null;
  }
}

/**
 * Paragraph world matrix scaling, orienting, and placing one label one atlas
 * dimension along its own signed axis from the scene origin.
 * @param spec Axis guide to place.
 * @param dimensions Atlas dimensions in mm as [ap, dv, ml].
 * @param fontSize Label em size in mm.
 */
function axisGuideMatrix(
  spec: AxisGuideSpec,
  dimensions: [number, number, number],
  fontSize: number
): Matrix {
  const index = AXIS_GUIDE_ASR_INDEX[spec.axis];
  const offset: [number, number, number] = [0, 0, 0];
  offset[index] = spec.sign * dimensions[index];
  const position = asrToBabylon(offset);

  return Matrix.Scaling(fontSize, fontSize, 1)
    .multiply(
      Matrix.RotationYawPitchRoll(
        spec.rotation.yaw,
        spec.rotation.pitch,
        spec.rotation.roll
      )
    )
    .multiply(Matrix.Translation(position.x, position.y, position.z));
}

/**
 * Em size in mm making the widest label exactly half the atlas's ML length.
 * @param mlLength Atlas ML extent in mm.
 * @param fontAsset Font asset the labels are measured with.
 */
function axisGuideFontSize(mlLength: number, fontAsset: FontAsset): number {
  const widest = Math.max(
    ...AXIS_GUIDE_SPECS.map(spec => labelWidthEm(spec.text, fontAsset))
  );
  return (mlLength * AXIS_GUIDE_WIDTH_ML_FRACTION) / widest;
}

/**
 * Width of a label in em, from the same layout engine that renders it.
 * @param text Label text to measure.
 * @param fontAsset Font asset the label is laid out with.
 */
function labelWidthEm(text: string, fontAsset: FontAsset): number {
  return new SdfTextParagraph(text, fontAsset).width * fontAsset.scale;
}
