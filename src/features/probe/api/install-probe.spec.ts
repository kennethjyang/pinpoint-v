import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  getProbeInterfaceProbe,
  parseProbeInterfaceFile
} from "@/features/probe";

// install-probe.api.ts calls `axios.create()` to build dedicated instances
// (githubApi, fileApi), so mocking `axios.get` alone wouldn't reach their
// `.get` calls. Make `create()` return the same mocked `axios` module so its
// `.get` is the one instance under test.
vi.mock("axios", async importOriginal => {
  const actual = await importOriginal<typeof import("axios")>();
  const mocked = { ...actual.default, get: vi.fn() };
  mocked.create = vi.fn().mockReturnValue(mocked);
  return { default: mocked };
});

function probeInterfaceFileText(
  probes: Record<string, unknown>[] = [
    { ndim: 2, si_units: "um", contact_positions: [[0, 0]] }
  ]
): string {
  return JSON.stringify({
    specification: "probeinterface",
    version: "0.2.24",
    probes
  });
}

describe("getProbeInterfaceProbe", () => {
  // axios.get is only ever passed to vi.mocked() to retrieve its mock, never
  // called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedGet = vi.mocked(axios.get);

  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("returns the first probe from a successful response", async () => {
    const probe = { ndim: 2, si_units: "um", contact_positions: [[0, 0]] };
    mockedGet.mockResolvedValue({
      data: {
        specification: "probeinterface",
        version: "0.2.24",
        probes: [probe]
      }
    });

    expect(await getProbeInterfaceProbe("neuropixels", "1.0")).toEqual(probe);
  });

  it("returns null when the response has no probes", async () => {
    mockedGet.mockResolvedValue({
      data: { specification: "probeinterface", version: "0.2.24", probes: [] }
    });

    expect(await getProbeInterfaceProbe("neuropixels", "1.0")).toBeNull();
  });

  it("returns null when the request throws", async () => {
    mockedGet.mockRejectedValue(new Error("network error"));

    expect(await getProbeInterfaceProbe("neuropixels", "1.0")).toBeNull();
  });
});

describe("parseProbeInterfaceFile", () => {
  it("returns the first probe from a valid ProbeInterface file", () => {
    const probe = { ndim: 2, si_units: "um", contact_positions: [[0, 0]] };

    expect(parseProbeInterfaceFile(probeInterfaceFileText([probe]))).toEqual(
      probe
    );
  });

  it("returns only the first probe when the file has more than one", () => {
    const first = { ndim: 2, si_units: "um", contact_positions: [[0, 0]] };
    const second = { ndim: 3, si_units: "mm", contact_positions: [[1, 1]] };

    expect(
      parseProbeInterfaceFile(probeInterfaceFileText([first, second]))
    ).toEqual(first);
  });

  it("returns null for invalid JSON", () => {
    expect(parseProbeInterfaceFile("not json")).toBeNull();
  });

  it("returns null when parsed JSON isn't an object", () => {
    expect(parseProbeInterfaceFile("42")).toBeNull();
  });

  it("returns null when probes is missing", () => {
    expect(
      parseProbeInterfaceFile(
        JSON.stringify({ specification: "probeinterface", version: "0.2.24" })
      )
    ).toBeNull();
  });

  it("returns null when probes is empty", () => {
    expect(parseProbeInterfaceFile(probeInterfaceFileText([]))).toBeNull();
  });

  it("returns null when the first probe is missing required fields", () => {
    expect(
      parseProbeInterfaceFile(
        probeInterfaceFileText([{ ndim: 2, si_units: "um" }])
      )
    ).toBeNull();
  });

  it("returns null when a required field has the wrong type", () => {
    expect(
      parseProbeInterfaceFile(
        probeInterfaceFileText([
          { ndim: "2", si_units: "um", contact_positions: [[0, 0]] }
        ])
      )
    ).toBeNull();
  });
});
