import type {
  GearCategory,
  GearProduct,
  GearProductOf,
} from "@/lib/schemas/gear";

/*
 * Gear value ranking (PLAN.md section 4, "Gear value ranking"). Order of rules:
 * 1. Minimum standards are hard gates: a product that misses one is never scored, ranked or picked.
 * 2. Performance 0-100 from published specs, each criterion min-max normalised within its category.
 * 3. Value = performance per euro, blended with performance (and lightness) by presets or a slider.
 */

/** Message keys (Gear.minimums.<key>) of the minimum standards a product fails; empty when it passes. */
export function failedMinimums(p: GearProduct): string[] {
  const failed: string[] = [];
  const need = (ok: boolean, key: string) => {
    if (!ok) failed.push(key);
  };
  switch (p.category) {
    case "transceiver":
      need(p.specs.digital, "digital");
      need(p.specs.antennas >= 3, "threeAntennas");
      need(p.specs.frequencyKHz === 457, "frequency457");
      need(p.specs.en300718, "en300718");
      need(p.specs.multipleBurialMarking, "marking");
      break;
    case "probe":
      need(p.specs.lengthCm >= MIN_PROBE_LENGTH_CM, "probeLength");
      need(p.specs.quickLock, "quickLock");
      break;
    case "shovel":
      need(p.specs.bladeMaterial === "metal", "metalBlade");
      need(p.specs.extendableShaft, "extendableShaft");
      break;
    case "airbag":
      need(p.specs.en16716, "en16716");
      break;
    case "helmet":
      need(p.specs.en1077, "en1077");
      break;
  }
  return failed;
}

export const MIN_PROBE_LENGTH_CM = 240;

/** Every minimum standard per category, in display order (the keys `failedMinimums` can return). */
export const MINIMUM_KEYS: Record<GearCategory, string[]> = {
  transceiver: [
    "digital",
    "threeAntennas",
    "frequency457",
    "en300718",
    "marking",
  ],
  probe: ["probeLength", "quickLock"],
  shovel: ["metalBlade", "extendableShaft"],
  airbag: ["en16716"],
  helmet: ["en1077"],
};

interface Criterion<C extends GearCategory> {
  key: string;
  raw: (p: GearProductOf<C>) => number | undefined;
  higherIsBetter: boolean;
}

const bool = (v: boolean | undefined) =>
  v === undefined ? undefined : v ? 1 : 0;

/** Published-spec criteria per category (message keys: Gear.criteria.<key>). */
const CRITERIA: { [C in GearCategory]: Criterion<C>[] } = {
  transceiver: [
    { key: "range", raw: (p) => p.specs.rangeM, higherIsBetter: true },
    {
      key: "searchStrip",
      raw: (p) => p.specs.searchStripM,
      higherIsBetter: true,
    },
    { key: "weight", raw: (p) => p.specs.weightG, higherIsBetter: false },
    {
      key: "battery",
      raw: (p) => p.specs.batterySendHours,
      higherIsBetter: true,
    },
  ],
  probe: [
    { key: "length", raw: (p) => p.specs.lengthCm, higherIsBetter: true },
    { key: "weight", raw: (p) => p.specs.weightG, higherIsBetter: false },
  ],
  shovel: [
    { key: "weight", raw: (p) => p.specs.weightG, higherIsBetter: false },
    {
      key: "shaftLength",
      raw: (p) => p.specs.maxLengthCm,
      higherIsBetter: true,
    },
    { key: "hoeMode", raw: (p) => bool(p.specs.hoeMode), higherIsBetter: true },
  ],
  airbag: [
    {
      key: "multipleDeployments",
      raw: (p) => bool(p.specs.multipleDeployments),
      higherIsBetter: true,
    },
    { key: "weight", raw: (p) => p.specs.weightG, higherIsBetter: false },
  ],
  helmet: [
    {
      key: "dualCertified",
      raw: (p) => bool(p.specs.en12492),
      higherIsBetter: true,
    },
    {
      key: "rotationalProtection",
      raw: (p) => bool(p.specs.rotationalProtection),
      higherIsBetter: true,
    },
    { key: "weight", raw: (p) => p.specs.weightG, higherIsBetter: false },
  ],
};

export function criteriaFor(category: GearCategory): string[] {
  return CRITERIA[category].map((c) => c.key);
}

/** 0-1 position of `v` between min and max; all-equal values count as 1 (no product is worse). */
function normalise(
  v: number,
  min: number,
  max: number,
  higherIsBetter: boolean,
) {
  if (max === min) return 1;
  const t = (v - min) / (max - min);
  return higherIsBetter ? t : 1 - t;
}

/** Normalised 0-1 values of a raw quantity across products (undefined stays undefined). */
function normaliseAll(
  values: (number | undefined)[],
  higherIsBetter: boolean,
): (number | undefined)[] {
  const present = values.filter((v): v is number => v !== undefined);
  if (present.length === 0) return values.map(() => undefined);
  const min = Math.min(...present);
  const max = Math.max(...present);
  return values.map((v) =>
    v === undefined ? undefined : normalise(v, min, max, higherIsBetter),
  );
}

const mean = (xs: (number | undefined)[]) => {
  const present = xs.filter((x): x is number => x !== undefined);
  return present.length
    ? present.reduce((a, b) => a + b, 0) / present.length
    : undefined;
};

export interface Blend {
  /** Weight of the performance score. */
  performance: number;
  /** Weight of performance per euro. */
  value: number;
  /** Weight of low weight (ski touring). */
  lightness: number;
}

export const GEAR_PRESET_KEYS = [
  "bestValue",
  "bestPerformance",
  "lightest",
  "budget",
] as const;
export type GearPresetKey = (typeof GEAR_PRESET_KEYS)[number];

export const GEAR_PRESETS: Record<GearPresetKey, Blend> = {
  bestValue: { performance: 0.5, value: 0.5, lightness: 0 },
  bestPerformance: { performance: 1, value: 0, lightness: 0 },
  lightest: { performance: 0.3, value: 0.2, lightness: 0.5 },
  budget: { performance: 0.2, value: 0.8, lightness: 0 },
};

/** The Performance <-> Price slider: 0 = all value for money, 100 = all performance. */
export function sliderBlend(performancePercent: number): Blend {
  const p = Math.min(100, Math.max(0, performancePercent)) / 100;
  return { performance: p, value: 1 - p, lightness: 0 };
}

export interface RankedGear {
  product: GearProduct;
  /** 0-100, from published specs. Undefined when no spec criterion is known. */
  performance: number | undefined;
  /** 0-100: performance per euro, relative to the category. */
  value: number | undefined;
  /** 0-100: the blended ranking score. */
  score: number;
}

/**
 * Scores and ranks the products of ONE category that meet the minimum standards. Products below the
 * minimums are dropped here; list them separately with `failedMinimums`.
 */
export function rankCategory(
  category: GearCategory,
  products: GearProduct[],
  blend: Blend = GEAR_PRESETS.bestValue,
): RankedGear[] {
  const eligible = products.filter(
    (p) => p.category === category && failedMinimums(p).length === 0,
  );
  const criteria = CRITERIA[category] as Criterion<GearCategory>[];

  const perCriterion = criteria.map((c) =>
    normaliseAll(
      eligible.map((p) => c.raw(p as never)),
      c.higherIsBetter,
    ),
  );
  const performance = eligible.map((_, i) => {
    const m = mean(perCriterion.map((col) => col[i]));
    return m === undefined ? undefined : m * 100;
  });

  // Performance per euro; a product without a performance score gets no value score.
  const perEuro = eligible.map((p, i) =>
    performance[i] === undefined ? undefined : performance[i] / p.priceEUR,
  );
  const value = normaliseAll(perEuro, true).map((v) =>
    v === undefined ? undefined : v * 100,
  );
  const lightness = normaliseAll(
    eligible.map((p) => p.specs.weightG),
    false,
  );

  return eligible
    .map((product, i) => {
      const parts = [
        [blend.performance, performance[i]],
        [blend.value, value[i]],
        [
          blend.lightness,
          lightness[i] === undefined ? undefined : lightness[i] * 100,
        ],
      ] as const;
      // Missing parts are skipped rather than counted as zero.
      const used = parts.filter(([w, v]) => w > 0 && v !== undefined);
      const weight = used.reduce((a, [w]) => a + w, 0);
      const score = weight
        ? used.reduce((a, [w, v]) => a + w * (v as number), 0) / weight
        : 0;
      return {
        product,
        performance: performance[i],
        value: value[i],
        score: Math.round(score),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.priceEUR - b.product.priceEUR ||
        a.product.id.localeCompare(b.product.id),
    );
}

/** Minimum performance for the "best value" pick, so a cheap but weak product is never the value pick. */
export const VALUE_PICK_MIN_PERFORMANCE = 60;

export interface Picks {
  bestPerformance?: GearProduct;
  bestValue?: GearProduct;
  budget?: GearProduct;
}

export function picksFor(
  category: GearCategory,
  products: GearProduct[],
): Picks {
  const ranked = rankCategory(category, products);
  const byPerf = [...ranked]
    .filter((r) => r.performance !== undefined)
    .sort(
      (a, b) =>
        (b.performance ?? 0) - (a.performance ?? 0) ||
        a.product.priceEUR - b.product.priceEUR,
    );
  const byValue = ranked
    .filter((r) => (r.performance ?? 0) >= VALUE_PICK_MIN_PERFORMANCE)
    .sort(
      (a, b) =>
        (b.value ?? 0) - (a.value ?? 0) ||
        a.product.priceEUR - b.product.priceEUR,
    );
  const byPrice = [...ranked].sort(
    (a, b) =>
      a.product.priceEUR - b.product.priceEUR ||
      a.product.id.localeCompare(b.product.id),
  );
  return {
    bestPerformance: byPerf[0]?.product,
    bestValue: byValue[0]?.product,
    budget: byPrice[0]?.product,
  };
}

export const KIT_KEYS = ["essential", "recommended", "lightweight"] as const;
export type KitKey = (typeof KIT_KEYS)[number];

const KIT_CATEGORIES: Record<KitKey, GearCategory[]> = {
  essential: ["transceiver", "probe", "shovel"],
  recommended: ["transceiver", "probe", "shovel", "helmet", "airbag"],
  lightweight: ["transceiver", "probe", "shovel"],
};

export interface GearKit {
  id: KitKey;
  items: GearProduct[];
  totalPriceEUR: number;
}

/**
 * A kit needs a qualifying product in every one of its categories; otherwise it is not offered (null),
 * because a partial "kit" would suggest the missing item is optional.
 */
export function buildKit(id: KitKey, products: GearProduct[]): GearKit | null {
  const items: GearProduct[] = [];
  for (const category of KIT_CATEGORIES[id]) {
    const pick =
      id === "lightweight"
        ? rankCategory(category, products, GEAR_PRESETS.lightest)[0]?.product
        : picksFor(category, products).bestValue;
    if (!pick) return null;
    items.push(pick);
  }
  return {
    id,
    items,
    totalPriceEUR: items.reduce((sum, p) => sum + p.priceEUR, 0),
  };
}

/** Prices are checked by hand; after 12 months they are shown with a warning. */
export const PRICE_STALE_MONTHS = 12;

export function isPriceStale(checkedAt: string, now: Date): boolean {
  const checked = new Date(`${checkedAt}T00:00:00Z`);
  const limit = new Date(now);
  limit.setUTCMonth(limit.getUTCMonth() - PRICE_STALE_MONTHS);
  return checked < limit;
}
