import type { DataStatus } from "@/lib/fetch-with-fallback";
import type { Resort } from "@/lib/schemas/resort";
import type { OpenMeteoLocation } from "./open-meteo";
import {
  FORECAST_DAYS,
  PAST_HOURS,
  POWDER_ALARM_CM,
  POWDER_ALARM_HOURS,
  WIND_WARNING_DAYS,
  WIND_WARNING_KMH,
} from "./thresholds";
import type { SnowForecast, SnowForecastDay } from "./types";

const HOUR_MS = 3_600_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function isPowderAlarm(next48hSnowfallCm: number): boolean {
  return next48hSnowfallCm >= POWDER_ALARM_CM;
}

/** True if any of the first WIND_WARNING_DAYS days has sustained wind at or above the threshold. */
export function hasWindWarning(days: SnowForecastDay[]): boolean {
  return days
    .slice(0, WIND_WARNING_DAYS)
    .some((d) => d.windMaxKmh >= WIND_WARNING_KMH);
}

export function toSnowForecast(
  loc: OpenMeteoLocation,
  resort: Resort,
  now: Date,
  dataStatus: DataStatus,
): SnowForecast {
  const nowMs = now.getTime();
  const today = now.toISOString().slice(0, 10);

  let past = 0;
  let next = 0;
  const freezingByDate = new Map<string, number[]>();
  loc.hourly.time.forEach((t, i) => {
    const ms = Date.parse(`${t}Z`);
    const snow = loc.hourly.snowfall[i] ?? 0;
    if (ms > nowMs - PAST_HOURS * HOUR_MS && ms <= nowMs) past += snow;
    if (ms > nowMs && ms <= nowMs + POWDER_ALARM_HOURS * HOUR_MS) next += snow;
    const fl = loc.hourly.freezing_level_height[i];
    if (fl != null) {
      const date = t.slice(0, 10);
      freezingByDate.set(date, [...(freezingByDate.get(date) ?? []), fl]);
    }
  });

  const d = loc.daily;
  const days: SnowForecastDay[] = [];
  d.time.forEach((date, i) => {
    if (date < today) return;
    const tempMax = d.temperature_2m_max[i];
    const tempMin = d.temperature_2m_min[i];
    const wind = d.wind_speed_10m_max[i];
    const gust = d.wind_gusts_10m_max[i];
    const dir = d.wind_direction_10m_dominant[i];
    // Drop days the model could not fully forecast rather than inventing values.
    if (
      tempMax == null ||
      tempMin == null ||
      wind == null ||
      gust == null ||
      dir == null
    )
      return;
    const levels = freezingByDate.get(date);
    days.push({
      date,
      snowfallCm: round1(d.snowfall_sum[i] ?? 0),
      freezingLevelM: levels?.length
        ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length / 10) *
          10
        : null,
      tempMinC: round1(tempMin),
      tempMaxC: round1(tempMax),
      windMaxKmh: Math.round(wind),
      windGustKmh: Math.round(gust),
      windDirectionDeg: Math.round(dir),
    });
  });
  const week = days.slice(0, FORECAST_DAYS);
  const next48hSnowfallCm = round1(next);

  return {
    resortSlug: resort.slug,
    generatedAt: now.toISOString(),
    elevationM: resort.summitPoint.elevation,
    days: week,
    past72hSnowfallCm: round1(past),
    next48hSnowfallCm,
    powderAlarm: isPowderAlarm(next48hSnowfallCm),
    windWarning: hasWindWarning(week),
    dataStatus,
  };
}

/**
 * Dates (UTC) of the current or upcoming Friday-Sunday weekend, never in the past:
 * Mon-Thu -> Fri, Sat, Sun; Fri -> Fri, Sat, Sun; Sat -> Sat, Sun; Sun -> Sun.
 */
export function weekendDates(now: Date): string[] {
  const dow = now.getUTCDay(); // 0 = Sunday
  const daysUntilFriday = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
  const dates: string[] = [];
  for (let i = 0; i < 3; i++) {
    const offset = daysUntilFriday + i;
    if (offset < 0) continue;
    dates.push(
      new Date(now.getTime() + offset * 24 * HOUR_MS)
        .toISOString()
        .slice(0, 10),
    );
  }
  return dates;
}

/** Total forecast snowfall on the given dates; `complete` is false if the forecast lacks any of them. */
export function snowOnDates(
  forecast: SnowForecast,
  dates: string[],
): { cm: number; complete: boolean } {
  const byDate = new Map(forecast.days.map((d) => [d.date, d.snowfallCm]));
  const cm = dates.reduce((sum, date) => sum + (byDate.get(date) ?? 0), 0);
  return { cm: round1(cm), complete: dates.every((date) => byDate.has(date)) };
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Compass point the wind blows FROM (meteorological convention). */
export function degToCompass(deg: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
