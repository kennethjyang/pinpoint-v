import type { Color3, Material, StandardMaterial } from "@babylonjs/core";

/**
 * Set a material's alpha, forcing the change through to the GPU, and skip
 * entirely when the alpha is unchanged. A frozen material only pushes its
 * `vDiffuseColor` uniform (which carries alpha) when its draw wrapper is
 * flagged for a full rebind, so writing `alpha` on its own would have no
 * visible effect on a frozen material. Safe to call on an unfrozen material
 * too.
 * @param material Material to set the alpha of.
 * @param alpha Alpha to set.
 */
export function setMaterialAlpha(material: Material, alpha: number): void {
  if (material.alpha === alpha) return;

  material.alpha = alpha;
  material.markDirty(true);
}

/**
 * Set a material's diffuse color, forcing the change through to the GPU, and
 * skip entirely when the color is unchanged. See {@link setMaterialAlpha} for
 * why the change has to be forced.
 * @param material Material to set the diffuse color of.
 * @param diffuseColor Diffuse color to set.
 */
export function setMaterialDiffuseColor(
  material: StandardMaterial,
  diffuseColor: Color3
): void {
  if (material.diffuseColor.equals(diffuseColor)) return;

  material.diffuseColor = diffuseColor;
  material.markDirty(true);
}
