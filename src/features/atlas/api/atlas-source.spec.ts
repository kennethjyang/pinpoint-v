import { describe, it, expect } from "vitest";
import { parseAtlasSourceResponse } from "@/features/atlas";

describe("parseAtlasSourceResponse", () => {
  it("keeps only folder entries", () => {
    const result = parseAtlasSourceResponse(
      {
        files: [
          { name: "allen_mouse", type: "folder" },
          { name: "readme.txt", type: "file" },
          { name: "allen_human", type: "folder" }
        ]
      },
      "http://localhost:3000"
    );

    expect(result).toEqual([
      { name: "allen_mouse", source: "http://localhost:3000" },
      { name: "allen_human", source: "http://localhost:3000" }
    ]);
  });

  it("returns [] when there are no files", () => {
    expect(
      parseAtlasSourceResponse({ files: [] }, "http://localhost:3000")
    ).toEqual([]);
  });

  it("returns [] when every entry is a non-folder", () => {
    const result = parseAtlasSourceResponse(
      { files: [{ name: "readme.txt", type: "file" }] },
      "http://localhost:3000"
    );

    expect(result).toEqual([]);
  });
});
