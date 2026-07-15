/**
 * Result of comparing an atlas's version against the running Pinpoint
 * version.
 */
export enum ConverterCompatibility {
  /** Versions match closely enough to use without caveats. */
  Compatible,
  /** The atlas version couldn't be read or parsed as semver. */
  Unverifiable,
  /** Minor version mismatch; Pinpoint is newer than the atlas. */
  Warn,
  /** Major version mismatch; Pinpoint is older than the atlas. */
  BlockPinpointOutdated,
  /** Major version mismatch; the atlas is older than Pinpoint. */
  BlockAtlasOutdated
}
