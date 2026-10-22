import { z } from "zod";
import type { SkiDay } from "./index";

/** Saved ski days live only on the device. Versioned so the format can change later. */
export const SKI_DAYS_STORAGE_KEY = "freeride-atlas:ski-days:v1";
export const MAX_SAVED_DAYS = 200;

const skiDaySchema = z.strictObject({
  id: z.string().min(1).max(40),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  distanceM: z.number().nonnegative(),
  descentM: z.number().nonnegative(),
  maxSpeedKmh: z.number().nonnegative(),
  movingMs: z.number().nonnegative(),
});

/** Reads saved days defensively (invalid entries dropped one by one), newest first. */
export function parseSkiDays(raw: string | null | undefined): SkiDay[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .flatMap((d) => {
      const r = skiDaySchema.safeParse(d);
      return r.success ? [r.data] : [];
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function addSkiDay(days: SkiDay[], day: SkiDay): SkiDay[] {
  return [day, ...days.filter((d) => d.id !== day.id)]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, MAX_SAVED_DAYS);
}

export function removeSkiDay(days: SkiDay[], id: string): SkiDay[] {
  return days.filter((d) => d.id !== id);
}
