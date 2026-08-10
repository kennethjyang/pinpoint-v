import { describe, expect, it } from "vitest";
import {
  PREFERENCES_FILE_NAME,
  applyPreferences,
  parsePreferencesFile,
  serializePreferences
} from "./preferences-file.api";
import {
  DEFAULT_TRANSFORM_CHAIN_ID,
  type TransformChain
} from "@/features/scene";
import type { Preferences } from "@/stores/preferences.store";

/**
 * Build a user transform chain fixture, so each test only needs to override
 * the field(s) it cares about.
 */
function makeUserChain(
  overrides: Partial<TransformChain> = {}
): TransformChain {
  return {
    id: "user-chain",
    name: "Manipulator",
    isBuiltIn: false,
    steps: [
      {
        kind: "translation",
        arguments: [
          { group: "globalTranslation", component: 0 },
          1.5,
          { group: "globalTranslation", component: 2 }
        ]
      },
      {
        kind: "rotation",
        arguments: [
          0,
          { group: "globalRotation", component: 1 },
          { group: "globalRotation", component: 2 }
        ]
      }
    ],
    depthAxis: { group: "localTranslation", component: 0 },
    ...overrides
  };
}

/**
 * Build a fully populated `Preferences` fixture, so each test only needs to
 * override the field(s) it cares about.
 */
function makePreferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    version: "5.0.0",
    appearance: "auto",
    isSplashScreenSkipped: false,
    cameraProjection: "perspective",
    cameraInertia: 0.9,
    worldBackgroundColor: "#33334d",
    worldLightIntensity: 1,
    materialSpecularIntensity: 1,
    materialSpecularPower: 64,
    isSsaoEnabled: true,
    ssaoRatio: 0.5,
    areStructureInteriorsHidden: true,
    positionUnit: "millimeter",
    rotationUnit: "degree",
    decimalPrecision: 3,
    probeShankThicknessMillimeters: 0.05,
    probeHeadStageLengthMillimeters: 20,
    probeHeadStageCutDepthMillimeters: 17.5,
    probeRodDiameterMillimeters: 8,
    probeRodLengthMillimeters: 200,
    transformInputNames: {
      globalTranslation: ["AP", "DV", "ML"],
      globalRotation: ["Roll", "Yaw", "Pitch"],
      localRotation: ["Local Roll", "Local Yaw", "Local Pitch"],
      localTranslation: ["Local AP", "Local DV", "Local ML"]
    },
    transformChains: [makeUserChain()],
    defaultProbeChainId: DEFAULT_TRANSFORM_CHAIN_ID,
    ...overrides
  };
}

describe("PREFERENCES_FILE_NAME", () => {
  it("is a JSON file name", () => {
    expect(PREFERENCES_FILE_NAME).toBe("pinpoint-preferences.json");
  });
});

describe("serializePreferences", () => {
  it("round-trips through parsePreferencesFile, including version", () => {
    const fixture = makePreferences();

    expect(parsePreferencesFile(serializePreferences(fixture))).toEqual(
      fixture
    );
  });

  it("writes only the twenty-three preference keys", () => {
    const fixture = { ...makePreferences(), junk: 1 } as Preferences;

    const keys = Object.keys(JSON.parse(serializePreferences(fixture)));

    expect(keys).toHaveLength(23);
    expect(keys).not.toContain("junk");
  });

  it("round-trips a user chain and every input name through applyPreferences", () => {
    const source = makePreferences({
      transformChains: [makeUserChain({ id: "mine", name: "Arm" })],
      defaultProbeChainId: "mine",
      transformInputNames: {
        globalTranslation: ["Stage X", "Stage Y", "Stage Z"],
        globalRotation: ["Roll", "Yaw", "Pitch"],
        localRotation: ["Local Roll", "Local Yaw", "Local Pitch"],
        localTranslation: ["Depth", "Local DV", "Local ML"]
      }
    });
    const store = makePreferences();

    const parsed = parsePreferencesFile(serializePreferences(source))!;
    applyPreferences(store, parsed, "9.9.9");

    expect(store.transformChains).toEqual(source.transformChains);
    expect(store.transformInputNames).toEqual(source.transformInputNames);
    expect(store.defaultProbeChainId).toBe("mine");
  });

  it("shares no chain or name references with the applied source", () => {
    const source = makePreferences();
    const store = makePreferences({ transformChains: [] });

    applyPreferences(store, source, "9.9.9");
    source.transformChains[0]!.steps[0]!.arguments[0] = 42;
    source.transformInputNames.globalTranslation[0] = "Renamed";

    expect(store.transformChains[0]!.steps[0]!.arguments[0]).toEqual({
      group: "globalTranslation",
      component: 0
    });
    expect(store.transformInputNames.globalTranslation[0]).toBe("AP");
  });
});

describe("parsePreferencesFile", () => {
  it("returns null for non-JSON text", () => {
    expect(parsePreferencesFile("not json")).toBeNull();
  });

  it("returns null for a JSON array", () => {
    expect(parsePreferencesFile("[]")).toBeNull();
  });

  it("returns null for a JSON null", () => {
    expect(parsePreferencesFile("null")).toBeNull();
  });

  it("returns null when version is missing", () => {
    const fixture: Partial<Preferences> = makePreferences();
    delete fixture.version;

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null when version is not a string", () => {
    const fixture = { ...makePreferences(), version: 5 };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for an unrecognized cameraProjection", () => {
    const fixture = { ...makePreferences(), cameraProjection: "isometric" };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for an unrecognized appearance", () => {
    const fixture = { ...makePreferences(), appearance: "sepia" };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a malformed worldBackgroundColor", () => {
    const fixture = { ...makePreferences(), worldBackgroundColor: "red" };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a non-boolean areStructureInteriorsHidden", () => {
    const fixture = {
      ...makePreferences(),
      areStructureInteriorsHidden: "true"
    };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a non-boolean isSsaoEnabled", () => {
    const fixture = { ...makePreferences(), isSsaoEnabled: "true" };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a non-boolean isSplashScreenSkipped", () => {
    const fixture = { ...makePreferences(), isSplashScreenSkipped: "true" };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for an ssaoRatio above 1", () => {
    const fixture = makePreferences({ ssaoRatio: 1.5 });

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null when a numeric field is missing", () => {
    const fixture: Partial<Preferences> = makePreferences();
    delete fixture.cameraInertia;

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a numeric field above its range", () => {
    const fixture = { ...makePreferences(), cameraInertia: 1.5 };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a numeric field below its range", () => {
    const fixture = { ...makePreferences(), materialSpecularPower: 0 };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a fractional decimalPrecision", () => {
    const fixture = { ...makePreferences(), decimalPrecision: 2.5 };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null when a numeric field serializes to null (NaN)", () => {
    const fixture = {
      ...makePreferences(),
      probeRodLengthMillimeters: Number.NaN
    };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("accepts a version that isn't valid semver", () => {
    const fixture = makePreferences({ version: "not-semver" });

    expect(parsePreferencesFile(JSON.stringify(fixture))?.version).toBe(
      "not-semver"
    );
  });

  it("accepts a well-formed user chain", () => {
    const fixture = makePreferences();

    expect(
      parsePreferencesFile(JSON.stringify(fixture))?.transformChains
    ).toEqual(fixture.transformChains);
  });

  it("returns null for a malformed chain", () => {
    const fixture = makePreferences({
      transformChains: [{ id: "broken" } as TransformChain]
    });

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a chain step argument that names no input", () => {
    const fixture = makePreferences({
      transformChains: [
        makeUserChain({
          steps: [{ kind: "translation", arguments: [0, 0] as never }]
        })
      ]
    });

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a chain claiming to be built in", () => {
    const fixture = makePreferences({
      transformChains: [makeUserChain({ isBuiltIn: true })]
    });

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null when transformChains is not an array", () => {
    const fixture = {
      ...makePreferences(),
      transformChains: { id: "user-chain" }
    };

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for a blank input name", () => {
    const fixture = makePreferences();
    fixture.transformInputNames.globalTranslation[1] = "";

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null when an input group's names are missing", () => {
    const fixture = makePreferences();
    // @ts-expect-error A file missing a group is exactly what this rejects.
    delete fixture.transformInputNames.localRotation;

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("returns null for an empty defaultProbeChainId", () => {
    const fixture = makePreferences({ defaultProbeChainId: "" });

    expect(parsePreferencesFile(JSON.stringify(fixture))).toBeNull();
  });

  it("accepts a defaultProbeChainId naming no chain the file carries", () => {
    const fixture = makePreferences({
      transformChains: [],
      defaultProbeChainId: "missing-chain"
    });

    expect(
      parsePreferencesFile(JSON.stringify(fixture))?.defaultProbeChainId
    ).toBe("missing-chain");
  });
});

describe("applyPreferences", () => {
  it("mutates the target in place, copying every non-version field and stamping the given version", () => {
    const target = makePreferences();
    const originalTarget = target;
    const source = makePreferences({
      cameraProjection: "orthographic",
      cameraInertia: 0.1,
      worldBackgroundColor: "#ff0000",
      areStructureInteriorsHidden: false,
      isSsaoEnabled: false,
      ssaoRatio: 0.25,
      positionUnit: "centimeter",
      rotationUnit: "radian",
      decimalPrecision: 1,
      probeRodLengthMillimeters: 150,
      version: "1.2.3"
    });

    applyPreferences(target, source, "9.9.9");

    expect(target).toBe(originalTarget);
    expect(target).toEqual({ ...source, version: "9.9.9" });
  });

  it("ignores an extra key on the source", () => {
    const target = makePreferences();
    const source = { ...makePreferences(), junk: 1 } as Preferences;

    applyPreferences(target, source, "9.9.9");

    expect(target).not.toHaveProperty("junk");
  });
});
