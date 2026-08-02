import { describe, expect, it } from "vitest";
import type { Array as ZarrArray, DataType, Readable } from "zarrita";
import type {
  AnnotationLevel,
  AnnotationVolume
} from "../models/annotation-level.model";
import type { SampleGeometry } from "../models/sample-geometry.model";
import { planSamples, selectSamplePlan } from "./sample-plan.api";

/**
 * Build a fake multiscale level for planning tests. `array` is never read by
 * the planner, so a stub satisfies the type without a real zarr store.
 */
function makeAnnotationLevel(
  overrides: Partial<AnnotationLevel> = {}
): AnnotationLevel {
  return {
    path: "s0",
    array: {} as unknown as ZarrArray<DataType, Readable>,
    shapeVoxels: [100, 100, 100],
    chunkShapeVoxels: [10, 10, 10],
    scaleMillimeters: [0.01, 0.01, 0.01],
    translationMillimeters: [0, 0, 0],
    ...overrides
  };
}

function makeGeometry(overrides: Partial<SampleGeometry> = {}): SampleGeometry {
  return {
    centerMillimeters: [0.5, 0.5, 0.5],
    rightMillimeters: [0, 0, 1],
    upMillimeters: [0, -1, 0],
    halfWidthMillimeters: 0.1,
    halfHeightMillimeters: 0.1,
    widthPixels: 4,
    heightPixels: 4,
    ...overrides
  };
}

describe("planSamples", () => {
  it("buckets every in-bounds sample under its chunk, with no sample lost or duplicated", () => {
    const level = makeAnnotationLevel();
    const geometry = makeGeometry();

    const plan = planSamples(geometry, level, 0);

    const seen = new Set<number>();
    for (const request of plan.chunkRequests) {
      for (const index of request.sampleIndices) {
        expect(seen.has(index)).toBe(false);
        seen.add(index);
      }
    }
    expect(seen.size).toBeLessThanOrEqual(plan.sampleCount);
    expect(plan.sampleCount).toBe(geometry.widthPixels * geometry.heightPixels);
  });

  it("buckets a non-square rectangle's samples, with no sample lost or duplicated", () => {
    const level = makeAnnotationLevel();
    const geometry = makeGeometry({
      halfWidthMillimeters: 0.02,
      halfHeightMillimeters: 0.2,
      widthPixels: 2,
      heightPixels: 8
    });

    const plan = planSamples(geometry, level, 0);

    const totalBucketed = plan.chunkRequests.reduce(
      (sum, request) => sum + request.sampleIndices.length,
      0
    );
    expect(totalBucketed).toBe(16);
    expect(plan.sampleCount).toBe(16);
  });

  it("resolves the exact chunk and voxel offset for a known axis-aligned rectangle", () => {
    // 1 chunk = 10^3 voxels, scale 0.01mm/voxel -> chunk = 0.1mm cube.
    // Center (0.05, 0.05, 0.05) is voxel (5,5,5), the center of chunk (0,0,0).
    const level = makeAnnotationLevel();
    const geometry = makeGeometry({
      centerMillimeters: [0.05, 0.05, 0.05],
      rightMillimeters: [0, 0, 1],
      upMillimeters: [0, -1, 0],
      halfWidthMillimeters: 0.005,
      halfHeightMillimeters: 0.005,
      widthPixels: 1,
      heightPixels: 1
    });

    const plan = planSamples(geometry, level, 0);

    expect(plan.chunkRequests).toHaveLength(1);
    expect(plan.chunkRequests[0]!.chunkCoordinates).toEqual([0, 0, 0]);
    // voxel (5,5,5) local to a 10^3 chunk -> offset (5*10+5)*10+5 = 555.
    expect(plan.chunkRequests[0]!.voxelOffsets[0]).toBe(555);
  });

  it("puts row 0 at the +up edge of the rectangle", () => {
    // up = -DV (superior). Row 0 should read the smallest DV (most superior)
    // voxel, row (size-1) the largest DV voxel.
    const level = makeAnnotationLevel({
      shapeVoxels: [100, 100, 100],
      chunkShapeVoxels: [10, 10, 10]
    });
    const geometry = makeGeometry({
      centerMillimeters: [0.5, 0.5, 0.5],
      rightMillimeters: [0, 0, 1],
      upMillimeters: [0, -1, 0],
      halfWidthMillimeters: 0.45,
      halfHeightMillimeters: 0.45,
      widthPixels: 2,
      heightPixels: 2
    });

    const plan = planSamples(geometry, level, 0);

    const chunkOfRow = (row: number) => {
      const index = row * geometry.widthPixels;
      const request = plan.chunkRequests.find(r =>
        r.sampleIndices.includes(index)
      );
      return request?.chunkCoordinates[1];
    };

    expect(chunkOfRow(0)).toBeLessThan(chunkOfRow(1)!);
  });

  it("drops samples that fall outside the volume", () => {
    const level = makeAnnotationLevel({ shapeVoxels: [10, 10, 10] });
    const geometry = makeGeometry({
      centerMillimeters: [0, 0, 0],
      halfWidthMillimeters: 1,
      halfHeightMillimeters: 1,
      widthPixels: 4,
      heightPixels: 4
    });

    const plan = planSamples(geometry, level, 0);

    const totalBucketed = plan.chunkRequests.reduce(
      (sum, request) => sum + request.sampleIndices.length,
      0
    );
    expect(totalBucketed).toBeLessThan(plan.sampleCount);
  });

  it("indexes each axis by its own anisotropic scale", () => {
    const level = makeAnnotationLevel({
      shapeVoxels: [100, 100, 100],
      chunkShapeVoxels: [100, 100, 100],
      scaleMillimeters: [0.02, 0.01, 0.005]
    });
    // A point 1 voxel off-center on each axis, in mm, using that axis's scale.
    const geometry = makeGeometry({
      centerMillimeters: [0.02, 0.01, 0.005],
      halfWidthMillimeters: 0.0001,
      halfHeightMillimeters: 0.0001,
      widthPixels: 1,
      heightPixels: 1
    });

    const plan = planSamples(geometry, level, 0);

    // Voxel (1, 1, 1) in a single 100^3 chunk -> offset (1*100+1)*100+1 = 10101.
    expect(plan.chunkRequests[0]!.voxelOffsets[0]).toBe(10101);
  });

  it("shifts the sampled voxel by a non-zero translation", () => {
    const level = makeAnnotationLevel({
      translationMillimeters: [0.03, 0, 0]
    });
    // Without the translation this would resolve to voxel 5; with it, voxel 2.
    const geometry = makeGeometry({
      centerMillimeters: [0.05, 0.05, 0.05],
      halfWidthMillimeters: 0.0001,
      halfHeightMillimeters: 0.0001,
      widthPixels: 1,
      heightPixels: 1
    });

    const plan = planSamples(geometry, level, 0);

    expect(plan.chunkRequests[0]!.voxelOffsets[0]).toBe(255);
  });
});

describe("selectSamplePlan", () => {
  function makeVolume(levels: Partial<AnnotationLevel>[]): AnnotationVolume {
    return {
      url: "http://example.com",
      levels: levels.map(makeAnnotationLevel)
    };
  }

  it("picks the finest level when it's within the chunk budget", () => {
    const volume = makeVolume([
      { scaleMillimeters: [0.01, 0.01, 0.01], chunkShapeVoxels: [50, 50, 50] },
      { scaleMillimeters: [0.1, 0.1, 0.1], chunkShapeVoxels: [10, 10, 10] }
    ]);
    const geometry = makeGeometry({
      halfWidthMillimeters: 0.05,
      halfHeightMillimeters: 0.05,
      widthPixels: 8,
      heightPixels: 8
    });

    const plan = selectSamplePlan(geometry, volume);

    expect(plan.levelIndex).toBe(0);
  });

  it("escalates to a coarser level when the finest exceeds the chunk budget", () => {
    const volume = makeVolume([
      // Tiny chunks force many distinct chunk requests at the finest level.
      { scaleMillimeters: [0.001, 0.001, 0.001], chunkShapeVoxels: [1, 1, 1] },
      { scaleMillimeters: [0.1, 0.1, 0.1], chunkShapeVoxels: [10, 10, 10] }
    ]);
    const geometry = makeGeometry({
      halfWidthMillimeters: 0.4,
      halfHeightMillimeters: 0.4,
      widthPixels: 8,
      heightPixels: 8
    });

    const plan = selectSamplePlan(geometry, volume);

    expect(plan.levelIndex).toBe(1);
  });

  it("returns the coarsest level when every level exceeds the budget", () => {
    const volume = makeVolume([
      { scaleMillimeters: [0.001, 0.001, 0.001], chunkShapeVoxels: [1, 1, 1] },
      { scaleMillimeters: [0.002, 0.002, 0.002], chunkShapeVoxels: [1, 1, 1] }
    ]);
    const geometry = makeGeometry({
      halfWidthMillimeters: 0.4,
      halfHeightMillimeters: 0.4,
      widthPixels: 8,
      heightPixels: 8
    });

    const plan = selectSamplePlan(geometry, volume);

    expect(plan.levelIndex).toBe(1);
  });

  it("returns an empty plan for a volume with no levels", () => {
    const volume: AnnotationVolume = { url: "http://example.com", levels: [] };

    const plan = selectSamplePlan(makeGeometry(), volume);

    expect(plan.levelIndex).toBe(0);
    expect(plan.chunkRequests).toEqual([]);
  });

  it("keys resolution on the finer of the two axis steps for a non-square rectangle", () => {
    // Width is sampled coarsely (stepU = 1mm) and height finely (stepV =
    // 0.001mm). Keying resolution off the coarser axis would accept the 1mm
    // level as fine enough and pick it; keying off the finer axis (correct)
    // restricts the match to the 0.001mm level.
    const volume = makeVolume([
      {
        scaleMillimeters: [0.001, 0.001, 0.001],
        chunkShapeVoxels: [100000, 100000, 100000],
        shapeVoxels: [200000, 200000, 200000]
      },
      {
        scaleMillimeters: [1, 1, 1],
        chunkShapeVoxels: [100000, 100000, 100000],
        shapeVoxels: [200000, 200000, 200000]
      }
    ]);
    const geometry = makeGeometry({
      centerMillimeters: [5, 5, 5],
      halfWidthMillimeters: 5,
      halfHeightMillimeters: 0.005,
      widthPixels: 10,
      heightPixels: 10
    });

    const plan = selectSamplePlan(geometry, volume);

    expect(plan.levelIndex).toBe(0);
  });
});
