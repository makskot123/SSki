import type { Aspect, Resort } from "@/lib/schemas/resort";

export interface Filters {
  /** ISO country codes; empty = all. */
  countries: string[];
  /** Typical day pass (midpoint of range) at most this many EUR; null = no limit. */
  maxPrice: number | null;
  /** Highest lift at least this many metres; null = no limit. */
  minTop: number | null;
  /** Resort must have off-piste terrain facing at least one of these; empty = any. */
  aspects: Aspect[];
  guides: boolean;
  beginner: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  countries: [],
  maxPrice: null,
  minTop: null,
  aspects: [],
  guides: false,
  beginner: false,
};

export function applyFilters(resort: Resort, f: Filters): boolean {
  if (f.countries.length > 0 && !f.countries.includes(resort.country))
    return false;
  const price =
    (resort.liftPass.dayPriceEUR.min + resort.liftPass.dayPriceEUR.max) / 2;
  if (f.maxPrice !== null && price > f.maxPrice) return false;
  if (f.minTop !== null && resort.elevation.top < f.minTop) return false;
  if (
    f.aspects.length > 0 &&
    !f.aspects.some((a) => resort.offPiste.mainAspects.includes(a))
  ) {
    return false;
  }
  if (f.guides && !resort.guidesAvailable) return false;
  if (f.beginner && !resort.offPiste.beginnerFriendly) return false;
  return true;
}
