/**
 * Result of comparing an atlas's converter version against the running
 * Pinpoint version.
 */
export enum ConverterCompatibility {
  /** Versions match closely enough to use without caveats. */
  Compatible,
  /** The converter version couldn't be read or parsed as semver. */
  Unverifiable,
  /** Minor version mismatch; Pinpoint is newer than the converter. */
  Warn,
  /** Major version mismatch; Pinpoint is older than the converter. */
  BlockPinpointOutdated,
  /** Major version mismatch; the converter is older than Pinpoint. */
  BlockAtlasOutdated
}
