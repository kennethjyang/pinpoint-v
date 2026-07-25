import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { Color3 } from "@babylonjs/core";
import {
  fetchAtlasMetadata,
  getDefaultStructureIds,
  structureEntityFromId
} from "@/features/atlas";
import { makeAtlas, makeAtlasMetadata, makeStructures } from "@/test/fixtures";

vi.mock("axios");

describe("getDefaultStructureIds", () => {
  it("returns the root structure's childrenIds", () => {
    const metadata = makeAtlasMetadata();
    expect(getDefaultStructureIds(metadata)).toEqual([1, 2]);
  });

  it("falls back to [] when the root structure is missing", () => {
    const metadata = makeAtlasMetadata({ rootId: 99 });
    expect(getDefaultStructureIds(metadata)).toEqual([]);
  });
});

describe("structureEntityFromId", () => {
  it("builds a StructureEntity with name, meshPath, and color", () => {
    const atlas = makeAtlas({
      name: "allen_mouse",
      source: "http://localhost:3000"
    });
    const metadata = makeAtlasMetadata();

    const entity = structureEntityFromId(atlas, metadata, 1);

    expect(entity).not.toBeNull();
    expect(entity!.name).toBe("1");
    expect(entity!.meshPath).toBe(
      "http://localhost:3000/allen_mouse/meshes/1.glb"
    );
    expect(entity!.color).toBeInstanceOf(Color3);
    expect(entity!.color.equals(Color3.FromInts(255, 0, 0))).toBe(true);
  });

  it("returns null when the id doesn't exist in the metadata", () => {
    const atlas = makeAtlas();
    const metadata = makeAtlasMetadata({ structures: makeStructures() });

    expect(structureEntityFromId(atlas, metadata, 999)).toBeNull();
  });
});

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
