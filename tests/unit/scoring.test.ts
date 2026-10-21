import { describe, expect, it } from "vitest";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/filters";
import { parseRankingQuery, serialiseRankingQuery } from "@/lib/ranking-query";
import { getResorts } from "@/lib/resorts";
import type { Resort } from "@/lib/schemas/resort";
import {
  DEFAULT_WEIGHTS,
  FACTOR_KEYS,
  PRESETS,
  scoreResorts,
  type Weights,
} from "@/lib/scoring";

const base = getResorts()[0];

function make(slug: string, patch: (r: Resort) => void): Resort {
  const r = structuredClone(base);
  r.slug = slug;
  r.name = slug;
  patch(r);
  return r;
}

const only = (key: keyof Weights, w = 1): Weights => ({
  ...(Object.fromEntries(FACTOR_KEYS.map((k) => [k, 0])) as Weights),
  [key]: w,
});

describe("scoreResorts", () => {
  it("normalises min-max: best = 100, worst = 0 for a single factor", () => {
    const a = make("a", (r) => (r.verticalDrop = 1000));
    const b = make("b", (r) => (r.verticalDrop = 2000));
    const c = make("c", (r) => (r.verticalDrop = 3000));
    const res = scoreResorts([a, b, c], only("vertical"));
    expect(res.map((s) => [s.resort.slug, s.score])).toEqual([
      ["c", 100],
      ["b", 50],
      ["a", 0],
    ]);
  });

  it("inverts price: cheaper scores higher", () => {
    const cheap = make(
      "cheap",
      (r) => (r.liftPass.dayPriceEUR = { min: 30, max: 40 }),
    );
    const dear = make(
      "dear",
      (r) => (r.liftPass.dayPriceEUR = { min: 90, max: 100 }),
    );
    const [first] = scoreResorts([dear, cheap], only("price"));
    expect(first.resort.slug).toBe("cheap");
    expect(first.score).toBe(100);
  });

  it("gives a neutral 50 when every resort has the same value", () => {
    const a = make("a", () => {});
    const b = make("b", () => {});
    expect(scoreResorts([a, b], only("terrain")).map((s) => s.score)).toEqual([
      50, 50,
    ]);
  });

  it("scores 0 for everyone when all weights are zero, ordered by name", () => {
    const z = make("z", (r) => (r.verticalDrop = 3000));
    const a = make("a", (r) => (r.verticalDrop = 1000));
    const res = scoreResorts([z, a], only("terrain", 0));
    expect(res.map((s) => s.score)).toEqual([0, 0]);
    expect(res.map((s) => s.resort.slug)).toEqual(["a", "z"]);
  });

  it("breaks ties alphabetically", () => {
    const b = make("b", () => {});
    const a = make("a", () => {});
    expect(
      scoreResorts([b, a], DEFAULT_WEIGHTS).map((s) => s.resort.slug),
    ).toEqual(["a", "b"]);
  });

  it("combines factors by weight (weighted average of normalised values)", () => {
    const a = make("a", (r) => {
      r.verticalDrop = 3000;
      r.offPiste.terrainVariety = 1;
    });
    const b = make("b", (r) => {
      r.verticalDrop = 1000;
      r.offPiste.terrainVariety = 5;
    });
    const w = { ...only("vertical", 3), terrain: 1 };
    const byslug = Object.fromEntries(
      scoreResorts([a, b], w).map((s) => [s.resort.slug, s.score]),
    );
    expect(byslug.a).toBeCloseTo(75); // (3*1 + 1*0) / 4
    expect(byslug.b).toBeCloseTo(25); // (3*0 + 1*1) / 4
  });

  it("skips the conditions factor when no data is given, and uses it when present", () => {
    const a = make("a", () => {});
    const b = make("b", () => {});
    const none = scoreResorts([a, b], only("conditions"));
    expect(none.map((s) => s.score)).toEqual([0, 0]);
    expect(none[0].factors.conditions).toBeNull();

    const withData = scoreResorts([a, b], only("conditions"), { a: 30, b: 0 });
    expect(withData[0].resort.slug).toBe("a");
    expect(withData[0].score).toBe(100);
  });

  it("leaves a factor out for a resort with missing data instead of scoring it 0", () => {
    const withSnow = make(
      "with",
      (r) => (r.climatology = { avgSeasonSnowfallCm: 500, source: "era5" }),
    );
    const noSnow = make("without", (r) => {
      delete r.climatology;
      r.offPiste.terrainVariety = 5;
    });
    const w = { ...only("snowfall"), terrain: 1 };
    const res = Object.fromEntries(
      scoreResorts([withSnow, noSnow], w).map((s) => [s.resort.slug, s]),
    );
    expect(res.without.factors.snowfall).toBeNull();
    expect(res.without.score).toBe(50); // only terrain counted, equal values -> 0.5
  });

  it("keeps scores in 0-100 for every preset on the real data", () => {
    for (const weights of Object.values(PRESETS)) {
      for (const s of scoreResorts(getResorts(), weights)) {
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("changes the leader when priorities change", () => {
    const resorts = getResorts();
    const cheapest = scoreResorts(resorts, only("price"))[0].resort.slug;
    const steepest = scoreResorts(resorts, only("steepness"))[0].resort.slug;
    expect(cheapest).not.toBe(steepest);
  });
});

describe("applyFilters", () => {
  const resorts = getResorts();
  const filter = (f: Partial<typeof DEFAULT_FILTERS>) =>
    resorts.filter((r) => applyFilters(r, { ...DEFAULT_FILTERS, ...f }));

  it("passes everything by default", () => {
    expect(filter({})).toHaveLength(resorts.length);
  });

  it("filters by country (multi)", () => {
    const out = filter({ countries: ["PL", "SK"] });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => ["PL", "SK"].includes(r.country))).toBe(true);
  });

  it("filters by max typical price and min top elevation", () => {
    expect(
      filter({ maxPrice: 50 }).every(
        (r) =>
          (r.liftPass.dayPriceEUR.min + r.liftPass.dayPriceEUR.max) / 2 <= 50,
      ),
    ).toBe(true);
    expect(filter({ minTop: 3500 }).every((r) => r.elevation.top >= 3500)).toBe(
      true,
    );
  });

  it("filters by aspect, guides and beginner flags", () => {
    expect(
      filter({ aspects: ["S"] }).every((r) =>
        r.offPiste.mainAspects.includes("S"),
      ),
    ).toBe(true);
    expect(filter({ guides: true }).every((r) => r.guidesAvailable)).toBe(true);
    const beginners = filter({ beginner: true });
    expect(beginners.length).toBeGreaterThan(0);
    expect(beginners.every((r) => r.offPiste.beginnerFriendly)).toBe(true);
  });
});

describe("ranking query", () => {
  it("round-trips non-default state", () => {
    const state = parseRankingQuery(
      new URLSearchParams(
        "price=5&snowfall=0&country=FR,CH&maxPrice=70&minTop=3000&aspect=N,NE&guides=1&beginner=1",
      ),
    );
    expect(state.weights.price).toBe(5);
    expect(state.weights.snowfall).toBe(0);
    expect(state.filters).toEqual({
      countries: ["FR", "CH"],
      maxPrice: 70,
      minTop: 3000,
      aspects: ["N", "NE"],
      guides: true,
      beginner: true,
    });
    expect(parseRankingQuery(serialiseRankingQuery(state))).toEqual(state);
  });

  it("writes an empty query for the defaults", () => {
    expect(serialiseRankingQuery(parseRankingQuery({})).toString()).toBe("");
  });

  it("ignores garbage and clamps weights to 0-5", () => {
    const s = parseRankingQuery({
      price: "99",
      terrain: "-1",
      vertical: "abc",
      country: "france,XX",
      aspect: "up,S",
      maxPrice: "x",
    });
    expect(s.weights.price).toBe(5);
    expect(s.weights.terrain).toBe(DEFAULT_WEIGHTS.terrain);
    expect(s.weights.vertical).toBe(DEFAULT_WEIGHTS.vertical);
    expect(s.filters.countries).toEqual(["XX"]);
    expect(s.filters.aspects).toEqual(["S"]);
    expect(s.filters.maxPrice).toBeNull();
  });

  it("accepts a plain searchParams object with array values", () => {
    expect(parseRankingQuery({ price: ["4", "1"] }).weights.price).toBe(4);
  });
});
