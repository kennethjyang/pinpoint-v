import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import Papa from "papaparse";
import {
  getTerminologyRows,
  listAtlases,
  listAtlasesHTTP
} from "@/features/atlas";
import { makeAtlas } from "@/test/fixtures";

vi.mock("axios");

// getTerminologyRows delegates the actual network fetch to PapaParse's
// `download: true` mode, so there's no axios/fetch call to mock here -
// mock Papa.parse itself and drive its `complete`/`error` callbacks
// directly.
vi.mock("papaparse", () => ({ default: { parse: vi.fn() } }));

const BRAINGLOBE_BASE_URL =
  "https://brainglobe.s3.us-west-2.amazonaws.com/atlas-rc2/";

describe("listAtlases", () => {
  // axios.get is only ever passed to vi.mocked() to retrieve its mock, never
  // called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedGet = vi.mocked(axios.get);

  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("requests the S3 terminology listing URL", async () => {
    mockedGet.mockResolvedValue({
      data: `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"></ListBucketResult>`
    });

    await listAtlases();

    expect(mockedGet).toHaveBeenCalledWith(
      "https://brainglobe.s3.us-west-2.amazonaws.com/?list-type=2&prefix=atlas-rc2%2Fterminologies%2F&delimiter=%2F",
      { responseType: "text" }
    );
  });

  it("returns atlases with the terminology suffix removed from their names", async () => {
    mockedGet.mockResolvedValue({
      data: `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CommonPrefixes><Prefix>atlas-rc2/terminologies/allen_mouse-terminology/</Prefix></CommonPrefixes>
  <CommonPrefixes><Prefix>atlas-rc2/terminologies/allen-adult-human-terminology/</Prefix></CommonPrefixes>
</ListBucketResult>`
    });

    const result = await listAtlases();

    expect(result).toEqual([
      { name: "allen_mouse", source: BRAINGLOBE_BASE_URL },
      { name: "allen-adult-human", source: BRAINGLOBE_BASE_URL }
    ]);
  });

  it("returns null when the request throws", async () => {
    mockedGet.mockRejectedValue(new Error("network error"));

    const result = await listAtlases();

    expect(result).toBeNull();
  });
});

describe("listAtlasesHTTP", () => {
  // axios.get is only ever passed to vi.mocked() to retrieve its mock, never
  // called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedGet = vi.mocked(axios.get);

  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("requests the terminologies directory on the given host", async () => {
    mockedGet.mockResolvedValue({ data: { files: [] } });

    await listAtlasesHTTP("http://localhost:3000");

    expect(mockedGet).toHaveBeenCalledWith(
      "http://localhost:3000/brainglobe-atlasapi/terminologies"
    );
  });

  it("keeps only folder entries and strips the terminology suffix", async () => {
    mockedGet.mockResolvedValue({
      data: {
        files: [
          { name: "allen_mouse-terminology", type: "folder" },
          { name: "readme.txt", type: "file" },
          { name: "allen-adult-human-terminology", type: "folder" }
        ]
      }
    });

    const result = await listAtlasesHTTP("http://localhost:3000");

    expect(result).toEqual([
      { name: "allen_mouse", source: "http://localhost:3000" },
      { name: "allen-adult-human", source: "http://localhost:3000" }
    ]);
  });

  it("returns null when the request throws", async () => {
    mockedGet.mockRejectedValue(new Error("network error"));

    const result = await listAtlasesHTTP("http://localhost:3000");

    expect(result).toBeNull();
  });
});

describe("getTerminologyRows", () => {
  // Papa.parse is only ever passed to vi.mocked() to retrieve its mock,
  // never called unbound.
  // oxlint-disable-next-line typescript/unbound-method
  const mockedParse = vi.mocked(Papa.parse);

  beforeEach(() => {
    mockedParse.mockReset();
  });

  /**
   * Extract the config object passed to the mocked `Papa.parse` call, typed
   * loosely since only `complete`/`error` are exercised here.
   */
  function config() {
    return mockedParse.mock.calls[0]![1] as {
      complete: (results: { data: unknown[]; errors: unknown[] }) => void;
      error: () => void;
    };
  }

  it("requests the terminology CSV URL for the atlas", async () => {
    const promise = getTerminologyRows(
      makeAtlas({ name: "allen_mouse", source: "http://localhost:3000/" })
    );
    config().complete({ data: [], errors: [] });
    await promise;

    expect(mockedParse).toHaveBeenCalledWith(
      "http://localhost:3000/terminologies/allen_mouse-terminology/3_0/terminology.csv",
      expect.objectContaining({ download: true, header: true })
    );
  });

  it("parses a single-element root_identifier_path into an array, not a number", async () => {
    const promise = getTerminologyRows(makeAtlas());
    config().complete({
      data: [
        {
          identifier: "997",
          parent_identifier: "",
          annotation_value: "997",
          name: "root",
          abbreviation: "root",
          color_hex_triplet: "#FFFFFF",
          root_identifier_path: "[997]"
        }
      ],
      errors: []
    });

    const result = await promise;

    expect(result[0]!.root_identifier_path).toEqual([997]);
  });

  it("parses a multi-element root_identifier_path", async () => {
    const promise = getTerminologyRows(makeAtlas());
    config().complete({
      data: [
        {
          identifier: "8",
          parent_identifier: "997",
          annotation_value: "8",
          name: "grey",
          abbreviation: "grey",
          color_hex_triplet: "#BFDAE3",
          root_identifier_path: "[997, 8]"
        }
      ],
      errors: []
    });

    const result = await promise;

    expect(result[0]!.root_identifier_path).toEqual([997, 8]);
  });

  it("converts identifier/annotation_value to numbers and blank parent_identifier to null", async () => {
    const promise = getTerminologyRows(makeAtlas());
    config().complete({
      data: [
        {
          identifier: "997",
          parent_identifier: "",
          annotation_value: "997",
          name: "root",
          abbreviation: "root",
          color_hex_triplet: "#FFFFFF",
          root_identifier_path: "[997]"
        }
      ],
      errors: []
    });

    const result = await promise;

    expect(result[0]!.identifier).toBe(997);
    expect(result[0]!.annotation_value).toBe(997);
    expect(result[0]!.parent_identifier).toBeNull();
  });

  it("keeps numeric-looking abbreviation and color_hex_triplet as strings", async () => {
    const promise = getTerminologyRows(makeAtlas());
    config().complete({
      data: [
        {
          identifier: "1",
          parent_identifier: "",
          annotation_value: "1",
          name: "root",
          abbreviation: "123",
          color_hex_triplet: "456",
          root_identifier_path: "[1]"
        }
      ],
      errors: []
    });

    const result = await promise;

    expect(result[0]!.abbreviation).toBe("123");
    expect(result[0]!.color_hex_triplet).toBe("456");
  });

  it("resolves an empty list when results.errors is non-empty", async () => {
    const promise = getTerminologyRows(makeAtlas());
    config().complete({ data: [{ identifier: "1" }], errors: [{}] });

    expect(await promise).toEqual([]);
  });

  it("resolves an empty list when the error callback fires", async () => {
    const promise = getTerminologyRows(makeAtlas());
    config().error();

    expect(await promise).toEqual([]);
  });

  it("doesn't throw on a malformed root_identifier_path cell", async () => {
    const promise = getTerminologyRows(makeAtlas());
    config().complete({
      data: [
        {
          identifier: "1",
          parent_identifier: "",
          annotation_value: "1",
          name: "root",
          abbreviation: "root",
          color_hex_triplet: "#FFFFFF",
          root_identifier_path: "not json"
        }
      ],
      errors: []
    });

    const result = await promise;

    expect(result[0]!.root_identifier_path).toEqual([]);
  });
});
