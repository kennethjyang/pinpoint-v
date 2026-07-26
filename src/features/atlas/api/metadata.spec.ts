import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { fetchAtlasMetadata } from "@/features/atlas";
import { makeAtlas, makeAtlasMetadata } from "@/test/fixtures";

vi.mock("axios");

describe("fetchAtlasMetadata", () => {
  const atlas = makeAtlas({
    name: "allen_mouse",
    source: "http://localhost:3000"
  });
  // axios.get is only ever passed to vi.mocked() to retrieve its mock, never
  // called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedGet = vi.mocked(axios.get);

  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("resolves the atlas.json URL from the atlas's source and name", async () => {
    const metadata = makeAtlasMetadata();
    mockedGet.mockResolvedValue({ data: metadata });

    const result = await fetchAtlasMetadata(atlas);

    expect(mockedGet).toHaveBeenCalledWith(
      "http://localhost:3000/allen_mouse/atlas.json"
    );
    expect(result).toEqual(metadata);
  });

  it("returns null when the request throws", async () => {
    mockedGet.mockRejectedValue(new Error("network error"));

    const result = await fetchAtlasMetadata(atlas);

    expect(result).toBeNull();
  });
});
