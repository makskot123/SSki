import { DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { aspectSchema, type Aspect } from "@/lib/schemas/resort";
import {
  DEFAULT_WEIGHTS,
  FACTOR_KEYS,
  MAX_WEIGHT,
  type Weights,
} from "@/lib/scoring";

export interface RankingState {
  weights: Weights;
  filters: Filters;
}

export const DEFAULT_STATE: RankingState = {
  weights: DEFAULT_WEIGHTS,
  filters: DEFAULT_FILTERS,
};

type Input = Record<string, string | string[] | undefined> | URLSearchParams;

function get(input: Input, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const v = input[key];
  return Array.isArray(v) ? v[0] : v;
}

function toInt(value: string | undefined): number | null {
  if (value === undefined || !/^\d{1,6}$/.test(value)) return null;
  return Number(value);
}

/** Tolerant parser: anything invalid falls back to the default instead of throwing. */
export function parseRankingQuery(input: Input): RankingState {
  const weights = { ...DEFAULT_WEIGHTS };
  for (const key of FACTOR_KEYS) {
    const n = toInt(get(input, key));
    if (n !== null) weights[key] = Math.min(n, MAX_WEIGHT);
  }

  const countries = (get(input, "country") ?? "")
    .split(",")
    .filter((c) => /^[A-Z]{2}$/.test(c));
  const aspects = (get(input, "aspect") ?? "")
    .split(",")
    .map((a) => aspectSchema.safeParse(a))
    .flatMap((r) => (r.success ? [r.data] : [])) as Aspect[];

  return {
    weights,
    filters: {
      countries: [...new Set(countries)],
      maxPrice: toInt(get(input, "maxPrice")),
      minTop: toInt(get(input, "minTop")),
      aspects: [...new Set(aspects)],
      guides: get(input, "guides") === "1",
      beginner: get(input, "beginner") === "1",
    },
  };
}

/** Only values that differ from the defaults are written, so the default URL stays clean. */
export function serialiseRankingQuery(state: RankingState): URLSearchParams {
  const p = new URLSearchParams();
  for (const key of FACTOR_KEYS) {
    if (state.weights[key] !== DEFAULT_WEIGHTS[key])
      p.set(key, String(state.weights[key]));
  }
  const f = state.filters;
  if (f.countries.length) p.set("country", f.countries.join(","));
  if (f.maxPrice !== null) p.set("maxPrice", String(f.maxPrice));
  if (f.minTop !== null) p.set("minTop", String(f.minTop));
  if (f.aspects.length) p.set("aspect", f.aspects.join(","));
  if (f.guides) p.set("guides", "1");
  if (f.beginner) p.set("beginner", "1");
  return p;
}
