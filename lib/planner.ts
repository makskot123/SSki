import { z } from "zod";
import type { DangerLevel } from "@/lib/schemas/avalanche";

/** Longest trip the planner accepts, in days. */
export const MAX_TRIP_DAYS = 14;
/** Share of the planner score that comes from forecast snow (the rest is the resort ranking score). */
export const SNOW_SHARE = 0.4;
/** A current level at or above this sorts the resort last (it is still listed, with the reason). */
export const HIGH_DANGER_LEVEL = 4;

const DAY_MS = 86_400_000;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) =>
  isoDay(new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS));

export interface PlannerQuery {
  from: string;
  to: string;
  /** ISO country code, or null for all countries. */
  country: string | null;
  /** True when the visitor's input had to be corrected (shown as a note). */
  adjusted: boolean;
}

/**
 * Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD&country=XX defensively. Defaults: today to today + 2 days.
 * Past start dates move to today, an end before the start moves to the start, and trips are capped at
 * MAX_TRIP_DAYS. Unknown countries mean "all".
 */
export function parsePlannerQuery(
  params: Record<string, string | string[] | undefined>,
  today: string,
  countries: string[],
): PlannerQuery {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const date = (k: string) => {
    const parsed = isoDate.safeParse(one(k));
    return parsed.success && !Number.isNaN(Date.parse(parsed.data))
      ? parsed.data
      : null;
  };
  let adjusted = false;
  const rawFrom = date("from");
  const rawTo = date("to");
  if ((one("from") && !rawFrom) || (one("to") && !rawTo)) adjusted = true;

  let from = rawFrom ?? today;
  if (from < today) {
    from = today;
    adjusted = true;
  }
  let to = rawTo ?? addDays(from, 2);
  if (to < from) {
    to = from;
    adjusted = true;
  }
  if (tripDates(from, to).length > MAX_TRIP_DAYS) {
    to = addDays(from, MAX_TRIP_DAYS - 1);
    adjusted = true;
  }
  const c = one("country")?.toUpperCase();
  const country = c && countries.includes(c) ? c : null;
  if (c && c !== "ALL" && !country) adjusted = true;
  return { from, to, country, adjusted };
}

/** Every date from `from` to `to`, inclusive. */
export function tripDates(from: string, to: string): string[] {
  const out: string[] = [];
  for (
    let d = from;
    d <= to && out.length <= MAX_TRIP_DAYS;
    d = addDays(d, 1)
  ) {
    out.push(d);
  }
  return out;
}

export type ForecastCoverage = "full" | "partial" | "none";

/** How many of the trip days the forecast covers. */
export function coverage(tripDays: string[], forecastDays: string[]) {
  const known = new Set(forecastDays);
  const covered = tripDays.filter((d) => known.has(d)).length;
  const kind: ForecastCoverage =
    covered === 0 ? "none" : covered === tripDays.length ? "full" : "partial";
  return { kind, covered, total: tripDays.length };
}

export interface PlanInput {
  slug: string;
  /** 0-100 ranking score with the default weights. */
  baseScore: number;
  /** Forecast snowfall on the covered trip days; null when not usable (beyond horizon or sample data). */
  tripSnowCm: number | null;
}

export interface PlanRow extends PlanInput {
  /** 0-100. */
  planScore: number;
}

/**
 * Planner score = resort score, blended with forecast snow for the trip when it is usable. Snow is
 * min-max normalised across the shortlist (as in the resort ranking). Without usable snow data the
 * resort score is used alone, so sample data never changes the order.
 */
export function planScores(rows: PlanInput[]): PlanRow[] {
  const snow = rows.flatMap((r) =>
    r.tripSnowCm === null ? [] : [r.tripSnowCm],
  );
  const min = Math.min(...snow);
  const max = Math.max(...snow);
  return rows.map((r) => {
    if (r.tripSnowCm === null || snow.length === 0) {
      return { ...r, planScore: r.baseScore };
    }
    const n = max === min ? 0.5 : (r.tripSnowCm - min) / (max - min);
    return {
      ...r,
      planScore: (1 - SNOW_SHARE) * r.baseScore + SNOW_SHARE * 100 * n,
    };
  });
}

/**
 * Final order: resorts whose CURRENT bulletin says level 4 or 5 go last (still listed, with the reason),
 * the rest by planner score, ties by name. Call with levels re-checked at the visitor's clock: a level
 * that is no longer current is null.
 */
export function orderPlan<T extends PlanRow & { name: string }>(
  rows: T[],
  currentLevel: (row: T) => DangerLevel | null,
): T[] {
  const high = (r: T) => (currentLevel(r) ?? 0) >= HIGH_DANGER_LEVEL;
  return [...rows].sort(
    (a, b) =>
      Number(high(a)) - Number(high(b)) ||
      b.planScore - a.planScore ||
      a.name.localeCompare(b.name, "en"),
  );
}
