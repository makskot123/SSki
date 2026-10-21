/**
 * Assigns EAWS micro-region ids to every resort (base and summit point) and writes them to
 * data/resorts.json (`avalancheRegionIds`).
 *
 * Run with: npm run data:regions-assign   (Node 24 runs .ts directly)
 *
 * Source: https://regions.avalanches.org/micro-regions.geojson (EAWS regions, CC0, ~16 MB).
 * Resorts in countries with no EAWS region (e.g. Bulgaria, Georgia) correctly end up with [].
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  regionIdsForPoints,
  type RegionFeature,
} from "../lib/geo/assign-regions.ts";

const REGIONS_URL = "https://regions.avalanches.org/micro-regions.geojson";
const DATA_FILE = fileURLToPath(
  new URL("../data/resorts.json", import.meta.url),
);

type SeedResort = {
  slug: string;
  coordinates: { lat: number; lon: number };
  summitPoint: { lat: number; lon: number };
  avalancheRegionIds: string[];
};

async function main() {
  const res = await fetch(REGIONS_URL, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${REGIONS_URL}`);
  const { features } = (await res.json()) as { features: RegionFeature[] };
  const today = new Date().toISOString().slice(0, 10);

  const resorts = JSON.parse(readFileSync(DATA_FILE, "utf8")) as SeedResort[];
  for (const r of resorts) {
    r.avalancheRegionIds = regionIdsForPoints(
      [r.coordinates, r.summitPoint],
      features,
      today,
    );
    console.log(
      `${r.slug.padEnd(20)} ${r.avalancheRegionIds.join(", ") || "(none)"}`,
    );
  }
  writeFileSync(DATA_FILE, JSON.stringify(resorts, null, 2) + "\n");
  console.log(
    `done: ${resorts.length} resorts, ${features.length} polygons checked`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
