/**
 * One-off script: average Nov-Apr snowfall per resort from Open-Meteo's ERA5
 * archive, written into data/resorts.json (`climatology`).
 *
 * Run with: npm run data:snowfall   (Node 24 runs .ts directly)
 *
 * Limits: ERA5 is a ~25 km reanalysis, so values are only comparable between
 * resorts, not exact point measurements. The same Nov-Apr window is used for
 * every resort (late-season resorts such as Riksgränsen are under-counted).
 * Open-Meteo free tier: non-commercial use, CC BY 4.0 attribution.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIRST_SEASON = 2015; // winter 2015/16
const LAST_SEASON = 2024; // winter 2024/25
const DATA_FILE = fileURLToPath(
  new URL("../data/resorts.json", import.meta.url),
);

type ArchiveResponse = {
  daily?: { time: string[]; snowfall_sum: (number | null)[] };
  error?: boolean;
  reason?: string;
};

type SeedResort = {
  slug: string;
  summitPoint: { lat: number; lon: number; elevation: number };
  climatology?: { avgSeasonSnowfallCm: number; source: "era5" | "resort" };
};

export function averageSeasonSnowfall(
  daily: { time: string[]; snowfall_sum: (number | null)[] },
  firstSeason: number,
  lastSeason: number,
): number {
  const totals = new Map<number, number>();
  daily.time.forEach((date, i) => {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    if (month > 4 && month < 11) return;
    const season = month >= 11 ? year : year - 1;
    if (season < firstSeason || season > lastSeason) return;
    totals.set(
      season,
      (totals.get(season) ?? 0) + (daily.snowfall_sum[i] ?? 0),
    );
  });
  const expected = lastSeason - firstSeason + 1;
  if (totals.size !== expected) {
    throw new Error(`expected ${expected} seasons, got ${totals.size}`);
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return Math.round(sum / expected);
}

async function fetchSeasonSnowfall(r: SeedResort): Promise<number> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.search = new URLSearchParams({
    latitude: String(r.summitPoint.lat),
    longitude: String(r.summitPoint.lon),
    elevation: String(r.summitPoint.elevation),
    start_date: `${FIRST_SEASON}-11-01`,
    end_date: `${LAST_SEASON + 1}-04-30`,
    daily: "snowfall_sum",
    timezone: "UTC",
  }).toString();

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    const body = (await res.json()) as ArchiveResponse;
    if (res.ok && body.daily) {
      return averageSeasonSnowfall(body.daily, FIRST_SEASON, LAST_SEASON);
    }
    console.warn(
      `${r.slug}: attempt ${attempt} failed: ${body.reason ?? res.status}`,
    );
    // "Minutely API request limit exceeded": wait for the next minute window.
    await new Promise((resolve) => setTimeout(resolve, 65_000));
  }
  throw new Error(`${r.slug}: Open-Meteo request failed`);
}

async function main() {
  const force = process.argv.includes("--force");
  const resorts = JSON.parse(readFileSync(DATA_FILE, "utf8")) as SeedResort[];
  for (const r of resorts) {
    if (r.climatology?.source === "era5" && !force) continue; // resumable
    const avg = await fetchSeasonSnowfall(r);
    r.climatology = { avgSeasonSnowfallCm: avg, source: "era5" };
    writeFileSync(DATA_FILE, JSON.stringify(resorts, null, 2) + "\n");
    console.log(`${r.slug.padEnd(20)} ${avg} cm`);
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  console.log(`done: ${resorts.length} resorts`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
