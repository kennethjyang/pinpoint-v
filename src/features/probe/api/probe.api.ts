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
    kind: "probe",
    name: `Probe ${uniqueName}`,
    color: STANDARD_COLORS[Math.floor(Math.random() * STANDARD_COLORS.length)]!,
    probeInterfaceProbe,
    tipPosition: [0, 0, 0],
    orientation: [0, 0, 0]
  };
}
