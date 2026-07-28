import { ProbeInterfaceProbe } from "@/features/probe";

export interface Probe {
  // Inspectable kind.
  kind: "probe";

  // Unique identifier.
  name: string;

  color: string;
  probeInterface: ProbeInterfaceProbe;

  // AP, DV, ML order. ASR orientation. In mm.
  tipPosition: [number, number, number];

  // Pitch, yaw, roll. Pivot on tip. In Degrees.
  orientation: [number, number, number];
}
