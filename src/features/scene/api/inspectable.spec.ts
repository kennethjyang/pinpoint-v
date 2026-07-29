import { describe, it, expect } from "vitest";
import { isSameInspectable } from "./inspectable.api";
import { makeProbe } from "@/test/fixtures";

describe("isSameInspectable", () => {
  it("returns true for two probes with the same name", () => {
    const a = makeProbe({ name: "A" });
    const b = makeProbe({ name: "A" });

    expect(isSameInspectable(a, b)).toBe(true);
  });

  it("returns false for two probes with different names", () => {
    const a = makeProbe({ name: "A" });
    const b = makeProbe({ name: "B" });

    expect(isSameInspectable(a, b)).toBe(false);
  });

  it("returns false when the inspectable kinds differ", () => {
    const a = makeProbe({ name: "A" });
    const b = { ...makeProbe({ name: "A" }), inspectableKind: "other" };

    expect(isSameInspectable(a, b as unknown as typeof a)).toBe(false);
  });
});
