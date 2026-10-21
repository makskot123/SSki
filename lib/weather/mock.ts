import type { Resort } from "@/lib/schemas/resort";
import { hasWindWarning, isPowderAlarm } from "./map";
import { FORECAST_DAYS } from "./thresholds";
import type { SnowForecast, SnowForecastDay } from "./types";

/** Small deterministic PRNG so sample data is stable for a given resort and day. */
function seeded(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Plausible but FAKE forecast, used only when the live API is unavailable.
 * Every consumer must show it as "sample data" (dataStatus === "mock").
 */
export function mockForecast(resort: Resort, now: Date): SnowForecast {
  const today = now.toISOString().slice(0, 10);
  const rand = seeded(`${resort.slug}:${today}`);
  const month = now.getUTCMonth() + 1;
  const winter = month >= 11 || month <= 4;
  const top = resort.summitPoint.elevation;

  const days: SnowForecastDay[] = Array.from(
    { length: FORECAST_DAYS },
    (_, i) => {
      const date = new Date(now.getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const snows = rand() < (winter ? 0.4 : 0.12);
      const tempMax =
        (winter ? -3 : 4) - (top - 2500) * 0.0065 + rand() * 4 - 2;
      const wind = 15 + rand() * 35;
      return {
        date,
        snowfallCm: snows ? round1(rand() * (winter ? 25 : 8)) : 0,
        freezingLevelM:
          Math.round(((winter ? 1800 : 3200) + rand() * 900) / 10) * 10,
        tempMinC: round1(tempMax - 3 - rand() * 3),
        tempMaxC: round1(tempMax),
        windMaxKmh: Math.round(wind),
        windGustKmh: Math.round(wind + 15 + rand() * 30),
        windDirectionDeg: Math.round(rand() * 359),
      };
    },
  );

  const next48 = round1(days[0].snowfallCm + days[1].snowfallCm);
  return {
    resortSlug: resort.slug,
    generatedAt: now.toISOString(),
    elevationM: top,
    days,
    past72hSnowfallCm: round1(rand() * (winter ? 30 : 6)),
    next48hSnowfallCm: next48,
    powderAlarm: isPowderAlarm(next48),
    windWarning: hasWindWarning(days),
    dataStatus: "mock",
  };
}
