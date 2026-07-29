import { markRaw, toRaw } from "vue";
import { Probe } from "../models/probe.model";
import { ProbeInterfaceProbe } from "../models/probe-interface.model";
import { STANDARD_COLORS } from "@/features/scene";


/**
 * Returns a probe referencing the given probe interface definition.
 *
 * Assigns a random color, random name, and sets the position and orientation to zero.
 *
 * @remarks Probe interface definition must be interned into the experiment for this probe to be usable.
 * @param probeInterfaceProbe Probe interface definition for the probe.
 */
export function buildProbe(probeInterfaceProbe: ProbeInterfaceProbe): Probe {
  const uniqueName = crypto.randomUUID().slice(0, 8);
  return {
    inspectableKind: "probe",
    name: `Probe ${uniqueName}`,
    color: STANDARD_COLORS[Math.floor(Math.random() * STANDARD_COLORS.length)]!,
    visibility: "visible",
    probeIdentifier: getProbeIdentifier(probeInterfaceProbe),
    tipPosition: [0, 0, 0],
    orientation: [0, 0, 0]
  };
}

/**
 * Detach a probe interface definition from Vue's reactivity.
 *
 * The definition is static reference data (contact positions, shapes, etc.)
 * that is never mutated once installed, but it lives inside the deeply
 * watched experiment state. Pinia's persistence subscription (and, in dev,
 * its devtools subscription) both watch the store's state with
 * `deep: true`, which would otherwise traverse every one of a probe's
 * (possibly thousands of) nested contact entries on *every* store mutation
 * -- including ones unrelated to this probe, like just selecting it.
 *
 * `structuredClone` gives the experiment its own portable copy, independent
 * of the source (e.g. a probe library entry) it was built from, and
 * `markRaw` opts that copy out of Vue's reactivity. `toRaw` first is
 * required: `structuredClone` throws on a reactive proxy.
 * @param probeInterfaceProbe Probe interface definition to detach.
 */
export function detachProbeInterfaceProbe(
  probeInterfaceProbe: ProbeInterfaceProbe
): ProbeInterfaceProbe {
  return markRaw(structuredClone(toRaw(probeInterfaceProbe)));
}

/**
 * Toggle a probe's visibility through the states.
 *
 * Visible -> Shanks -> Hidden.
 * @param probe Probe to change the visibility of.
 */
export function rotateProbeVisibility(probe: Probe) {
  switch (probe.visibility) {
    case "visible":
      probe.visibility = "shanks";
      break;
    case "shanks":
      probe.visibility = "hidden";
      break;
    case "hidden":
      probe.visibility = "visible";
      break;
    default:
      probe.visibility = "hidden";
      break;
  }
}

/**
 * Returns the probe's manufacturer and name as a string.
 *
 * These are known but hidden keys in the interface that are used to identify the probe.
 * @param probeInterfaceProbe Probe interface definition to extract identifier from.
 */
export function getProbeIdentifier(
  probeInterfaceProbe: ProbeInterfaceProbe
): string {
  return `${String(probeInterfaceProbe.annotations!.manufacturer)} ${String(probeInterfaceProbe.annotations!.model_name)}`;
}
