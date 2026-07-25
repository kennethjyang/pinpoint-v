import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { listAtlases, listAtlasesHTTP } from "@/features/atlas";

vi.mock("axios");

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
