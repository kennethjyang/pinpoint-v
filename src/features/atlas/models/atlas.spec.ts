import { describe, it, expect } from "vitest";
import { atlasDisplayName } from "./atlas.model";

describe("atlasDisplayName", () => {
  it("title-cases a multi-word snake_case name", () => {
    expect(atlasDisplayName("allen_mouse")).toBe("Allen Mouse");
  });

  it("uppercases known acronym tokens", () => {
    expect(atlasDisplayName("whs_sd_rat")).toBe("WHS SD Rat");
    expect(atlasDisplayName("perens_lsfm_mouse")).toBe("Perens LSFM Mouse");
  });

  it("title-cases a single word", () => {
    expect(atlasDisplayName("example")).toBe("Example");
  });

  it("returns an empty string unchanged", () => {
    expect(atlasDisplayName("")).toBe("");
  });
});
