import { Probe } from "../models/probe.model";
import { ProbeInterfaceProbe } from "../models/probe-interface.model";
import { STANDARD_COLORS } from "@/features/scene";

/**
 * Returns a probe using the probe interface
 * @param probeInterfaceProbe
 */
export function buildProbe(probeInterfaceProbe: ProbeInterfaceProbe): Probe {
  const uniqueName = crypto.randomUUID().slice(0, 8);
  return {
    inspectableKind: "probe",
    name: `Probe ${uniqueName}`,
    color: STANDARD_COLORS[Math.floor(Math.random() * STANDARD_COLORS.length)]!,
    visibility: "visible",
    probeInterfaceProbe,
    tipPosition: [0, 0, 0],
    orientation: [0, 0, 0]
  };
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
