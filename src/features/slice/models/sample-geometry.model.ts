/**
 * An oriented rectangle through the annotation volume, sampled row-major with
 * row 0 at the +up edge. A square is the special case `halfWidthMillimeters
 * === halfHeightMillimeters` and `widthPixels === heightPixels`.
 */
export interface SampleGeometry {
  /** Rectangle center, in atlas ASR mm. */
  centerMillimeters: [number, number, number];
  /** Unit ASR direction of the rectangle's +u (rightward) axis. */
  rightMillimeters: [number, number, number];
  /** Unit ASR direction of the rectangle's +v (upward) axis. */
  upMillimeters: [number, number, number];
  /** Half the rectangle's u extent, in mm. */
  halfWidthMillimeters: number;
  /** Half the rectangle's v extent, in mm. */
  halfHeightMillimeters: number;
  /** Edge length of the output along u, in pixels. */
  widthPixels: number;
  /** Edge length of the output along v, in pixels. */
  heightPixels: number;
}
