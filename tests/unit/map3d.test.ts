import { describe, expect, it } from "vitest";
import { regionMeta } from "@/lib/avalanche/meta";
import { bboxOf } from "@/lib/geo/bbox";
import { canUse3D, isSoftwareRenderer } from "@/lib/map/graphics";
import {
  MAX_PITCH,
  PITCH_3D,
  TERRAIN_ATTRIBUTION,
  TERRAIN_EXAGGERATION,
  TERRAIN_MAX_ZOOM,
  TERRAIN_TILES,
} from "@/lib/map/terrain";
import { parseMapView, resolveMapView } from "@/lib/map/view-preference";
import { getResorts } from "@/lib/resorts";

describe("graphics capability", () => {
  it("recognises software renderers, including the exact string seen in A0", () => {
    expect(
      isSoftwareRenderer(
        "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      ),
    ).toBe(true);
    expect(isSoftwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe(true);
    expect(isSoftwareRenderer("Microsoft Basic Render Driver")).toBe(true);
    expect(isSoftwareRenderer("softpipe")).toBe(true);
  });

  it("treats real GPUs and hidden renderer strings as hardware", () => {
    expect(
      isSoftwareRenderer(
        "ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      ),
    ).toBe(false);
    expect(isSoftwareRenderer("Apple GPU")).toBe(false);
    expect(isSoftwareRenderer("Adreno (TM) 642L")).toBe(false);
    expect(isSoftwareRenderer("unknown")).toBe(false);
  });

  it("offers 3D only with WebGL2 and a hardware renderer", () => {
    expect(canUse3D({ webgl2: true, renderer: "Adreno (TM) 642L" })).toBe(true);
    expect(canUse3D({ webgl2: false, renderer: "Adreno (TM) 642L" })).toBe(
      false,
    );
    expect(canUse3D({ webgl2: true, renderer: "SwiftShader driver" })).toBe(
      false,
    );
    expect(canUse3D({ webgl2: false, renderer: "none" })).toBe(false);
  });
});

describe("2D/3D preference", () => {
  it("parses only the two known values", () => {
    expect(parseMapView("2d")).toBe("2d");
    expect(parseMapView("3d")).toBe("3d");
    for (const raw of [null, undefined, "", "3D", "true", '"3d"'])
      expect(parseMapView(raw)).toBeNull();
  });

  it("defaults to 2D on phones and 3D on larger screens", () => {
    expect(resolveMapView({ saved: null, can3D: true, phoneLike: true })).toBe(
      "2d",
    );
    expect(resolveMapView({ saved: null, can3D: true, phoneLike: false })).toBe(
      "3d",
    );
  });

  it("respects the visitor's saved choice", () => {
    expect(resolveMapView({ saved: "3d", can3D: true, phoneLike: true })).toBe(
      "3d",
    );
    expect(resolveMapView({ saved: "2d", can3D: true, phoneLike: false })).toBe(
      "2d",
    );
  });

  it("never chooses 3D on a device that cannot do it, even if it was saved", () => {
    expect(
      resolveMapView({ saved: "3d", can3D: false, phoneLike: false }),
    ).toBe("2d");
    expect(
      resolveMapView({ saved: null, can3D: false, phoneLike: false }),
    ).toBe("2d");
  });
});

describe("terrain budget (PLAN.md section 8.8)", () => {
  it("matches the A0 decisions", () => {
    expect(TERRAIN_MAX_ZOOM).toBe(12);
    expect(TERRAIN_EXAGGERATION).toBe(1.3);
    expect(PITCH_3D).toBe(60);
    expect(MAX_PITCH).toBe(70);
    expect(PITCH_3D).toBeLessThanOrEqual(MAX_PITCH);
    expect(TERRAIN_TILES[0]).toMatch(
      /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\/\{z\}\/\{x\}\/\{y\}\.png$/,
    );
  });

  it("carries the elevation credits, short enough not to cover the map", () => {
    for (const part of [
      "Mapzen",
      "AWS Terrain Tiles",
      "EU-DEM",
      "Copernicus",
      "offene Daten Österreichs",
      "USGS",
    ]) {
      expect(TERRAIN_ATTRIBUTION).toContain(part);
    }
    expect(TERRAIN_ATTRIBUTION).toContain(
      'href="https://registry.opendata.aws/terrain-tiles/"',
    );
    const visibleText = TERRAIN_ATTRIBUTION.replace(/<[^>]+>/g, "");
    expect(visibleText.length).toBeLessThan(120);
  });
});

describe("bounding boxes", () => {
  const square = [
    [
      [0, 0],
      [10, 0],
      [10, 5],
      [0, 5],
      [0, 0],
    ],
  ];

  it("covers a polygon including a hole, rounded", () => {
    const withHole = [
      ...square,
      [
        [2, 2],
        [3, 2],
        [3, 3],
        [2, 2],
      ],
    ];
    expect(bboxOf({ type: "Polygon", coordinates: withHole })).toEqual([
      0, 0, 10, 5,
    ]);
    expect(
      bboxOf({
        type: "Polygon",
        coordinates: [
          [
            [1.23456, 2.34567],
            [3.45678, 4.56789],
            [1.23456, 2.34567],
          ],
        ],
      }),
    ).toEqual([1.235, 2.346, 3.457, 4.568]);
  });

  it("covers every part of a multipolygon", () => {
    const other = [
      [
        [20, -5],
        [25, -5],
        [25, 1],
        [20, -5],
      ],
    ];
    expect(
      bboxOf({ type: "MultiPolygon", coordinates: [square, other] }),
    ).toEqual([0, -5, 25, 5]);
  });

  it("returns null for empty geometry", () => {
    expect(bboxOf({ type: "MultiPolygon", coordinates: [] })).toBeNull();
  });
});

describe("region metadata boxes (generated data)", () => {
  it("has a valid box for every region", () => {
    for (const [id, r] of Object.entries(regionMeta.regions)) {
      expect(r.b, id).toBeDefined();
      const [w, s, e, n] = r.b!;
      expect(w, id).toBeLessThan(e);
      expect(s, id).toBeLessThan(n);
      expect(w, id).toBeGreaterThanOrEqual(-180);
      expect(n, id).toBeLessThanOrEqual(90);
    }
  });

  it("contains each resort's base or summit for the regions it was assigned to", () => {
    const inside = (p: { lat: number; lon: number }, b: number[]) =>
      p.lon >= b[0] - 0.01 &&
      p.lon <= b[2] + 0.01 &&
      p.lat >= b[1] - 0.01 &&
      p.lat <= b[3] + 0.01;
    for (const resort of getResorts()) {
      for (const id of resort.avalancheRegionIds) {
        const b = regionMeta.regions[id]?.b;
        expect(b, `${resort.slug} ${id}`).toBeDefined();
        expect(
          inside(resort.coordinates, b!) || inside(resort.summitPoint, b!),
          `${resort.slug} ${id}`,
        ).toBe(true);
      }
    }
  });
});
