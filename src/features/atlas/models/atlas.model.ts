/**
 * Atlas identifier.
 */
export interface Atlas {
  name: string;
  source: string;
}

/**
 * Tokens in atlas folder names that are acronyms and should stay uppercase
 * rather than being title-cased, e.g. `whs_sd_rat` -> `WHS SD Rat`.
 */
const ACRONYMS = new Set([
  "whs", // Waxholm Space
  "sd", // Sprague Dawley
  "mpin", // Max Planck Institute of Neurobiology
  "admba", // Allen Developing Mouse Brain Atlas
  "lsfm", // light-sheet fluorescence microscopy
  "stp", // serial two-photon tomography
  "azba", // Adult Zebrafish Brain Atlas
  "unam", // Universidad Nacional Autónoma de México
  "sju", // Saint Joseph's University
  "mri" // magnetic resonance imaging
]);

/**
 * Convert an atlas's internal snake_case name into a human-readable display
 * name, e.g. `allen_mouse` -> `Allen Mouse`. Known acronyms
 * ({@link ACRONYMS}) are uppercased instead of title-cased.
 *
 * Display only: the snake_case {@link Atlas.name} is what source URLs,
 * favorites and reference coordinate overrides are keyed on.
 * @param name Internal atlas name.
 */
export function atlasDisplayName(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map(word =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}
