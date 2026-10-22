import { describe, expect, it } from "vitest";
import raw from "@/data/gear.json";
import {
  buildKit,
  failedMinimums,
  GEAR_PRESETS,
  isPriceStale,
  MINIMUM_KEYS,
  picksFor,
  rankCategory,
  sliderBlend,
} from "@/lib/gear";
import {
  gearDataSchema,
  gearProductSchema,
  type GearProduct,
} from "@/lib/schemas/gear";

// Test fixtures only (fictional products): the real seed holds only manufacturer-verified data.
const base = {
  brand: "Test",
  priceCheckedAt: "2026-10-01",
  sourceUrl: "https://example.com/spec",
};
const transceiver = (
  id: string,
  priceEUR: number,
  specs: Partial<Extract<GearProduct, { category: "transceiver" }>["specs"]>,
): GearProduct => ({
  ...base,
  id,
  model: id,
  priceEUR,
  category: "transceiver",
  specs: {
    digital: true,
    antennas: 3,
    frequencyKHz: 457,
    en300718: true,
    multipleBurialMarking: true,
    ...specs,
  },
});
const probe = (
  id: string,
  priceEUR: number,
  lengthCm: number,
  weightG?: number,
  quickLock = true,
): GearProduct => ({
  ...base,
  id,
  model: id,
  priceEUR,
  category: "probe",
  specs: { lengthCm, quickLock, material: "aluminium", weightG },
});
const shovel = (
  id: string,
  priceEUR: number,
  weightG: number,
  bladeMaterial: "metal" | "plastic" = "metal",
): GearProduct => ({
  ...base,
  id,
  model: id,
  priceEUR,
  category: "shovel",
  specs: { bladeMaterial, extendableShaft: true, weightG },
});

const T_TOP = transceiver("t-top", 500, {
  rangeM: 70,
  searchStripM: 70,
  weightG: 200,
});
const T_MID = transceiver("t-mid", 300, {
  rangeM: 55,
  searchStripM: 50,
  weightG: 210,
});
const T_CHEAP_WEAK = transceiver("t-weak", 150, {
  rangeM: 30,
  searchStripM: 30,
  weightG: 260,
});
// Cheap and "excellent" on paper, but analog with one antenna: must never be ranked or picked.
const T_ANALOG = transceiver("t-analog", 50, {
  digital: false,
  antennas: 1,
  multipleBurialMarking: false,
  rangeM: 90,
  searchStripM: 90,
  weightG: 150,
});

describe("seed data", () => {
  it("validates, and every product has a manufacturer source and a check date", () => {
    const data = gearDataSchema.parse(raw);
    for (const p of data.products) {
      expect(p.sourceUrl).toMatch(/^https:\/\//);
      expect(p.priceCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("rejects http links, unknown categories and duplicate ids", () => {
    expect(() =>
      gearProductSchema.parse({ ...T_TOP, sourceUrl: "http://example.com" }),
    ).toThrow();
    expect(() =>
      gearProductSchema.parse({ ...T_TOP, category: "skis" }),
    ).toThrow();
    expect(() => gearDataSchema.parse({ products: [T_TOP, T_TOP] })).toThrow();
  });
});

describe("minimum standards", () => {
  it("every failed minimum is one of the listed minimums of its category", () => {
    const failing = [
      T_ANALOG,
      probe("x", 1, 100, undefined, false),
      shovel("y", 1, 1, "plastic"),
    ];
    for (const p of failing) {
      for (const key of failedMinimums(p))
        expect(MINIMUM_KEYS[p.category]).toContain(key);
    }
  });

  it("lists every failed minimum", () => {
    expect(failedMinimums(T_ANALOG)).toEqual([
      "digital",
      "threeAntennas",
      "marking",
    ]);
    expect(failedMinimums(T_TOP)).toEqual([]);
    expect(failedMinimums(probe("short", 40, 200, undefined, false))).toEqual([
      "probeLength",
      "quickLock",
    ]);
    expect(failedMinimums(shovel("plastic", 30, 500, "plastic"))).toEqual([
      "metalBlade",
    ]);
  });

  it("a product below the minimums is never ranked or picked, however cheap or good on paper", () => {
    const all = [T_TOP, T_MID, T_CHEAP_WEAK, T_ANALOG];
    for (const preset of Object.values(GEAR_PRESETS)) {
      expect(
        rankCategory("transceiver", all, preset).map((r) => r.product.id),
      ).not.toContain("t-analog");
    }
    const picks = picksFor("transceiver", all);
    expect(Object.values(picks).map((p) => p?.id)).not.toContain("t-analog");
    expect(picks.budget?.id).toBe("t-weak");
  });
});

describe("scores", () => {
  const all = [T_TOP, T_MID, T_CHEAP_WEAK];

  it("performance is 0-100 from specs, best product 100", () => {
    const ranked = rankCategory(
      "transceiver",
      all,
      GEAR_PRESETS.bestPerformance,
    );
    expect(ranked.map((r) => r.product.id)).toEqual([
      "t-top",
      "t-mid",
      "t-weak",
    ]);
    expect(ranked[0].performance).toBe(100);
    expect(ranked[2].performance).toBe(0);
  });

  it("value rewards performance per euro", () => {
    const ranked = rankCategory("transceiver", all, sliderBlend(0));
    expect(ranked[0].product.id).toBe("t-mid");
    expect(ranked[0].value).toBe(100);
  });

  it("missing specs are skipped, not counted as zero", () => {
    const a = probe("p-a", 60, 240);
    const b = probe("p-b", 60, 280);
    const ranked = rankCategory("probe", [a, b], GEAR_PRESETS.bestPerformance);
    // Only length is known: 280 cm is best, 240 cm worst; weight (missing) does not drag either down.
    expect(ranked.map((r) => [r.product.id, r.performance])).toEqual([
      ["p-b", 100],
      ["p-a", 0],
    ]);
  });

  it("the slider moves between value (0) and performance (100)", () => {
    expect(sliderBlend(100)).toEqual({
      performance: 1,
      value: 0,
      lightness: 0,
    });
    expect(sliderBlend(-5)).toEqual({ performance: 0, value: 1, lightness: 0 });
  });

  it("the lightest preset favours low weight", () => {
    const light = probe("p-light", 120, 240, 200);
    const heavy = probe("p-heavy", 60, 240, 400);
    expect(
      rankCategory("probe", [heavy, light], GEAR_PRESETS.lightest)[0].product
        .id,
    ).toBe("p-light");
  });
});

describe("picks and kits", () => {
  const products = [
    T_TOP,
    T_MID,
    T_CHEAP_WEAK,
    probe("p-a", 70, 240, 300),
    probe("p-b", 90, 300, 260),
    shovel("s-a", 80, 600),
    shovel("s-b", 60, 700),
  ];

  it("best value needs performance of at least 60", () => {
    const picks = picksFor("transceiver", products);
    expect(picks.bestPerformance?.id).toBe("t-top");
    expect(picks.bestValue?.id).not.toBe("t-weak");
    expect(picks.budget?.id).toBe("t-weak");
  });

  it("the essential kit holds one of each and its total price", () => {
    const kit = buildKit("essential", products);
    expect(kit?.items.map((p) => p.category)).toEqual([
      "transceiver",
      "probe",
      "shovel",
    ]);
    expect(kit?.totalPriceEUR).toBe(
      kit!.items.reduce((s, p) => s + p.priceEUR, 0),
    );
  });

  it("a kit is not offered while a category has no qualifying product", () => {
    expect(buildKit("recommended", products)).toBeNull();
    expect(buildKit("essential", [T_TOP])).toBeNull();
  });
});

describe("price age", () => {
  it("flags prices checked more than 12 months ago", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    expect(isPriceStale("2025-10-23", now)).toBe(false);
    expect(isPriceStale("2025-10-21", now)).toBe(true);
  });
});
