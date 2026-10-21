/**
 * Builds the static map data for the avalanche page from the public EAWS regions
 * (https://regions.avalanches.org, CC0):
 *
 *   public/data/avalanche-regions.json  simplified GeoJSON polygons, properties: { id }
 *   public/data/avalanche-meta.json     region names (en, pl), outline per region, official services
 *
 * Run with: npm run data:regions   (Node 24 runs .ts directly)
 *
 * Polygons are simplified with a topology-preserving algorithm, so neighbouring regions keep
 * sharing exactly the same border (no gaps or overlaps) while the 16 MB source shrinks to ~1 MB.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, simplify } from "topojson-simplify";
import { outlineFor } from "../lib/avalanche/outline.ts";
import { isValidOn, type RegionFeature } from "../lib/geo/assign-regions.ts";

const BASE = "https://regions.avalanches.org";
const OUT_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));

/** Visvalingam effective-area threshold in square degrees (4e-5 deg^2 is roughly 0.3 km^2 at 47 deg N). */
const MIN_WEIGHT = Number(process.env.MIN_WEIGHT ?? 4e-5);
const QUANTIZATION = 1e5;
const DECIMALS = 4;
const MAX_BYTES = 1_500_000;

type Outline = {
  id: string;
  aws: { name: string; url: Record<string, unknown> }[];
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return (await res.json()) as T;
}

const round = (n: number) => Number(n.toFixed(DECIMALS));
const roundPos = (p: Position): Position => [round(p[0]), round(p[1])];

/** Best human-readable link: English if available, otherwise the first plain http(s) URL. */
function pickUrl(url: Record<string, unknown>): string | null {
  const isHttp = (v: unknown): v is string =>
    typeof v === "string" && /^https?:\/\//.test(v);
  if (isHttp(url.en)) return url.en;
  for (const [key, value] of Object.entries(url)) {
    if (!key.startsWith("api") && isHttp(value)) return value;
  }
  return null;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const [source, outlines, namesEn, namesPl] = await Promise.all([
    getJson<{ features: RegionFeature[] }>("micro-regions.geojson"),
    getJson<Outline[]>("outline_properties/index.json"),
    getJson<Record<string, string>>("micro-regions_names/en.json"),
    getJson<Record<string, string>>("micro-regions_names/pl.json"),
  ]);

  const valid = source.features.filter((f) => isValidOn(f, today));
  const ids = valid.map((f) => f.properties.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("duplicate region ids valid on the same day");

  const collection: FeatureCollection<Polygon | MultiPolygon, { id: string }> =
    {
      type: "FeatureCollection",
      features: valid.map((f) => ({
        type: "Feature",
        properties: { id: f.properties.id },
        geometry: f.geometry as unknown as Polygon | MultiPolygon,
      })),
    };

  // topojson's typings are stricter than the GeoJSON we feed it, so go through `never` once here.
  const topo = simplify(
    presimplify(topology({ regions: collection }, QUANTIZATION) as never),
    MIN_WEIGHT,
  );
  const simplified = feature(
    topo,
    topo.objects.regions as never,
  ) as unknown as FeatureCollection<Polygon | MultiPolygon, { id: string }>;

  const features: Feature<Polygon | MultiPolygon, { id: string }>[] =
    simplified.features
      .map((f) => ({
        type: "Feature" as const,
        properties: { id: f.properties.id },
        geometry:
          f.geometry.type === "Polygon"
            ? {
                type: "Polygon" as const,
                coordinates: f.geometry.coordinates.map((r) => r.map(roundPos)),
              }
            : {
                type: "MultiPolygon" as const,
                coordinates: f.geometry.coordinates.map((p) =>
                  p.map((r) => r.map(roundPos)),
                ),
              },
      }))
      // Simplification can collapse a tiny polygon completely; drop those rather than emit invalid geometry.
      .filter((f) =>
        f.geometry.type === "Polygon"
          ? f.geometry.coordinates[0]?.length >= 4
          : f.geometry.coordinates.some((p) => p[0]?.length >= 4),
      );

  const geojson = JSON.stringify({ type: "FeatureCollection", features });
  if (geojson.length > MAX_BYTES)
    throw new Error(
      `regions file is ${geojson.length} bytes, limit ${MAX_BYTES}`,
    );

  const outlineIds = new Set(outlines.map((o) => o.id));
  const regions: Record<string, { n: [string, string]; o: string | null }> = {};
  for (const id of ids) {
    regions[id] = {
      n: [namesEn[id] ?? id, namesPl[id] ?? namesEn[id] ?? id],
      o: outlineFor(id, outlineIds),
    };
  }
  const services: Record<string, { name: string; url: string }[]> = {};
  for (const o of outlines) {
    services[o.id] = o.aws.flatMap((a) => {
      const url = pickUrl(a.url);
      return url ? [{ name: a.name, url }] : [];
    });
  }
  const meta = JSON.stringify({ generated: today, regions, services });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}avalanche-regions.json`, geojson);
  writeFileSync(`${OUT_DIR}avalanche-meta.json`, meta);

  const dropped = valid.length - features.length;
  console.log(
    `regions: ${features.length}/${valid.length} (dropped ${dropped}), geometry ${(geojson.length / 1e6).toFixed(2)} MB, meta ${(meta.length / 1e3).toFixed(0)} KB`,
  );
  console.log(
    `regions without outline: ${ids.filter((i) => !regions[i].o).length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
