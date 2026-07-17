import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { fetchAtlasSource, parseAtlasSourceResponse } from "@/features/atlas";

vi.mock("axios");

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

describe("fetchAtlasSource", () => {
  // axios.get is only ever passed to vi.mocked() to retrieve its mock, never
  // called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedGet = vi.mocked(axios.get);

  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("connects to the source and returns the parsed atlases", async () => {
    mockedGet.mockResolvedValue({
      data: {
        files: [
          { name: "allen_mouse", type: "folder" },
          { name: "readme.txt", type: "file" }
        ]
      }
    });

    const result = await fetchAtlasSource("http://localhost:3000");

    expect(mockedGet).toHaveBeenCalledWith("http://localhost:3000");
    expect(result).toEqual([
      { name: "allen_mouse", source: "http://localhost:3000" }
    ]);
  });

  it("returns null when the response has no data", async () => {
    mockedGet.mockResolvedValue({ data: null });

    const result = await fetchAtlasSource("http://localhost:3000");

    expect(result).toBeNull();
  });

  it("returns null when the request throws", async () => {
    mockedGet.mockRejectedValue(new Error("network error"));

    const result = await fetchAtlasSource("http://localhost:3000");

    expect(result).toBeNull();
  });
});
