import type { Resort } from "@/lib/schemas/resort";

export const FACTOR_KEYS = [
  "terrain",
  "vertical",
  "snowfall",
  "altitude",
  "steepness",
  "liftAccess",
  "price",
  "conditions",
  "safety",
] as const;

export type FactorKey = (typeof FACTOR_KEYS)[number];
export type Weights = Record<FactorKey, number>;
/** Fresh snow in the last 72 h (cm) per resort slug. Filled by the forecast layer (M4). */
export type Conditions = Partial<Record<string, number>>;

export const MAX_WEIGHT = 5;

export const DEFAULT_WEIGHTS: Weights = {
  terrain: 3,
  vertical: 2,
  snowfall: 3,
  altitude: 2,
  steepness: 2,
  liftAccess: 2,
  price: 1,
  conditions: 2,
  safety: 1,
};

export const PRESET_KEYS = [
  "balanced",
  "powder",
  "budget",
  "steep",
  "safety",
] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export const PRESETS: Record<PresetKey, Weights> = {
  balanced: DEFAULT_WEIGHTS,
  powder: {
    terrain: 2,
    vertical: 1,
    snowfall: 5,
    altitude: 3,
    steepness: 1,
    liftAccess: 2,
    price: 1,
    conditions: 5,
    safety: 1,
  },
  budget: {
    terrain: 2,
    vertical: 2,
    snowfall: 2,
    altitude: 1,
    steepness: 1,
    liftAccess: 2,
    price: 5,
    conditions: 1,
    safety: 1,
  },
  steep: {
    terrain: 4,
    vertical: 4,
    snowfall: 2,
    altitude: 2,
    steepness: 5,
    liftAccess: 3,
    price: 0,
    conditions: 1,
    safety: 0,
  },
  safety: {
    terrain: 2,
    vertical: 1,
    snowfall: 2,
    altitude: 2,
    steepness: 0,
    liftAccess: 2,
    price: 1,
    conditions: 1,
    safety: 5,
  },
};

interface FactorSpec {
  /** Raw value for a resort, or undefined when the data is missing. */
  raw: (r: Resort, conditions?: Conditions) => number | undefined;
  higherIsBetter: boolean;
}

const FACTORS: Record<FactorKey, FactorSpec> = {
  terrain: { raw: (r) => r.offPiste.terrainVariety, higherIsBetter: true },
  vertical: { raw: (r) => r.verticalDrop, higherIsBetter: true },
  snowfall: {
    raw: (r) => r.climatology?.avgSeasonSnowfallCm,
    higherIsBetter: true,
  },
  altitude: {
    raw: (r) => (r.elevation.top + r.elevation.bottom) / 2,
    higherIsBetter: true,
  },
  steepness: {
    raw: (r) => r.offPiste.typicalSteepnessDeg.max,
    higherIsBetter: true,
  },
  liftAccess: {
    raw: (r) => r.offPiste.freerideZones.length,
    higherIsBetter: true,
  },
  price: {
    raw: (r) => (r.liftPass.dayPriceEUR.min + r.liftPass.dayPriceEUR.max) / 2,
    higherIsBetter: false,
  },
  conditions: { raw: (r, c) => c?.[r.slug], higherIsBetter: true },
  safety: {
    raw: (r) =>
      (r.guidesAvailable ? 0.5 : 0) + (r.offPiste.beginnerFriendly ? 0.5 : 0),
    higherIsBetter: true,
  },
};

export interface ScoredResort {
  resort: Resort;
  /** 0-100. */
  score: number;
  /** Normalised 0-1 value per factor (1 = best in the set); null when data is missing. */
  factors: Record<FactorKey, number | null>;
}

/** Min-max normalisation to 0-1; equal values map to a neutral 0.5. */
function normalise(
  values: (number | undefined)[],
  higherIsBetter: boolean,
): (number | null)[] {
  const defined = values.filter((v): v is number => v !== undefined);
  const min = Math.min(...defined);
  const max = Math.max(...defined);
  return values.map((v) => {
    if (v === undefined) return null;
    if (max === min) return 0.5;
    const n = (v - min) / (max - min);
    return higherIsBetter ? n : 1 - n;
  });
}

/**
 * Weighted score per resort. Each factor is normalised across the whole set passed in
 * (so filtering the list afterwards does not change anyone's score). A factor with
 * missing data for a resort is left out of that resort's average. Result is sorted by
 * score descending, ties by name.
 */
export function scoreResorts(
  resorts: Resort[],
  weights: Weights,
  conditions?: Conditions,
): ScoredResort[] {
  const normalised = Object.fromEntries(
    FACTOR_KEYS.map((key) => {
      const spec = FACTORS[key];
      return [
        key,
        normalise(
          resorts.map((r) => spec.raw(r, conditions)),
          spec.higherIsBetter,
        ),
      ];
    }),
  ) as Record<FactorKey, (number | null)[]>;

  const scored = resorts.map((resort, i): ScoredResort => {
    const factors = Object.fromEntries(
      FACTOR_KEYS.map((key) => [key, normalised[key][i]]),
    ) as Record<FactorKey, number | null>;

    let weighted = 0;
    let totalWeight = 0;
    for (const key of FACTOR_KEYS) {
      const value = factors[key];
      const w = weights[key];
      if (value === null || w <= 0) continue;
      weighted += w * value;
      totalWeight += w;
    }
    return {
      resort,
      factors,
      score: totalWeight > 0 ? (100 * weighted) / totalWeight : 0,
    };
  });

  return scored.sort(
    (a, b) =>
      b.score - a.score || a.resort.name.localeCompare(b.resort.name, "en"),
  );
}
