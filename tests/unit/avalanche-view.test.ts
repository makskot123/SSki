import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegionIndex } from "@/lib/avalanche/freshness";
import {
  fillColorExpression,
  fillOpacityExpression,
  NO_DATA_FILL,
} from "@/lib/avalanche/map-style";
import { parseCaamlFeed } from "@/lib/avalanche/normalise";
import { outlineFor } from "@/lib/avalanche/outline";
import { PROVIDERS, feedUrlFor } from "@/lib/avalanche/providers";
import {
  bulletinFor,
  currentLevels,
  describeElevation,
  toView,
} from "@/lib/avalanche/view";
import { DANGER_COLORS } from "@/lib/palette";

const load = (name: string) =>
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "../fixtures/avalanche", name),
      "utf8",
    ),
  );
const tyrol = parseCaamlFeed(load("tyrol-2026-02-15.json"), PROVIDERS.euregio);
const slf = parseCaamlFeed(load("slf-2026-02-15.json"), PROVIDERS.slf);
const day = new Date("2026-02-15T10:00:00Z");

describe("view model", () => {
  const view = toView(buildRegionIndex([...tyrol, ...slf], day));

  it("stores each bulletin once and points regions at it", () => {
    expect(view.bulletins).toHaveLength(tyrol.length + slf.length);
    const regionCount = Object.keys(view.regions).length;
    const perBulletinRegions = [...tyrol, ...slf].reduce(
      (n, b) => n + b.regionIds.length,
      0,
    );
    expect(regionCount).toBeLessThanOrEqual(perBulletinRegions);
    expect(bulletinFor(view, "AT-07-07")?.provider.id).toBe("euregio");
    expect(bulletinFor(view, "CH-6112")?.provider.id).toBe("slf");
    expect(bulletinFor(view, "XX-00")).toBeUndefined();
  });

  it("survives JSON serialisation (it is sent to the browser)", () => {
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });

  it("keeps provider region names", () => {
    expect(bulletinFor(view, "CH-6112")?.regionNames["CH-6112"]).toBe(
      "Upper Valle Leventina",
    );
  });

  it("colours only current bulletins, with the bulletin's highest level", () => {
    const levels = currentLevels(view);
    expect(Object.keys(levels).length).toBe(Object.keys(view.regions).length);
    for (const [id, level] of Object.entries(levels)) {
      expect(level, id).toBe(bulletinFor(view, id)!.maxDangerLevel);
      expect([1, 2, 3, 4, 5]).toContain(level);
    }
  });

  it("never colours stale bulletins, e.g. the same data viewed months later", () => {
    const later = toView(
      buildRegionIndex([...tyrol, ...slf], new Date("2026-10-21T10:00:00Z")),
    );
    expect(Object.keys(later.regions).length).toBeGreaterThan(0);
    expect(currentLevels(later)).toEqual({});
  });

  it("never colours a bulletin that only has no_snow / no_rating", () => {
    const noRating = {
      ...tyrol[0],
      dangerRatings: [{ level: null, validTimePeriod: "all_day" as const }],
      maxDangerLevel: null,
    };
    const v = toView(buildRegionIndex([noRating], day));
    expect(Object.keys(v.regions).length).toBeGreaterThan(0);
    expect(currentLevels(v)).toEqual({});
  });
});

describe("map paint expressions", () => {
  it("falls back to plain grey when nothing is current", () => {
    expect(fillColorExpression({})).toBe(NO_DATA_FILL);
    expect(fillOpacityExpression({})).toBeLessThan(0.3);
  });

  it("groups region ids per level with the EAWS colours and grey as default", () => {
    const expr = fillColorExpression({ A: 1, B: 3, C: 3, D: 5 }) as unknown[];
    expect(expr.slice(0, 2)).toEqual(["match", ["get", "id"]]);
    expect(expr).toContain(DANGER_COLORS[3].fill);
    expect(expr).not.toContain(DANGER_COLORS[2].fill); // no level-2 region, so no level-2 branch
    const i3 = expr.indexOf(DANGER_COLORS[3].fill);
    expect(expr[i3 - 1]).toEqual(["B", "C"]);
    expect(expr[expr.length - 1]).toBe(NO_DATA_FILL);
    // a match expression is [match, input, (label, output)*, fallback]: odd length >= 5
    expect(expr.length % 2).toBe(1);
  });

  it("makes coloured regions more opaque than grey ones", () => {
    const expr = fillOpacityExpression({ A: 2 }) as unknown[];
    expect(expr[0]).toBe("case");
    expect(expr[2]).toBeGreaterThan(expr[3] as number);
  });
});

describe("describeElevation", () => {
  it("distinguishes all, above, below and between, including treeline", () => {
    expect(describeElevation(undefined)).toEqual({ kind: "all" });
    expect(describeElevation({ lowerBound: 2200 })).toEqual({
      kind: "above",
      bound: 2200,
    });
    expect(describeElevation({ upperBound: "treeline" })).toEqual({
      kind: "below",
      bound: "treeline",
    });
    expect(describeElevation({ lowerBound: 1800, upperBound: 2600 })).toEqual({
      kind: "between",
      lower: 1800,
      upper: 2600,
    });
  });
});

describe("outlineFor", () => {
  const outlines = new Set([
    "AT-07",
    "AT",
    "CH",
    "IT-32-BZ",
    "IT-25",
    "PL",
    "PL-12",
  ]);
  it("uses the longest known prefix", () => {
    expect(outlineFor("AT-07-14-02", outlines)).toBe("AT-07");
    expect(outlineFor("CH-4231", outlines)).toBe("CH");
    expect(outlineFor("PL-12", outlines)).toBe("PL-12");
    expect(outlineFor("PL-99", outlines)).toBe("PL");
    expect(outlineFor("IT-32-BZ-04", outlines)).toBe("IT-32-BZ");
  });
  it("returns null when nothing matches", () => {
    expect(outlineFor("IT-MeteoMont-01-1", new Set(["IT-25"]))).toBeNull();
  });
});

describe("feedUrlFor", () => {
  it("uses the default unless overridden by an environment variable", () => {
    expect(feedUrlFor("slf")).toBe(PROVIDERS.slf.feedUrl);
    process.env.AVALANCHE_SLF_FEED_URL = "http://localhost:1/slf.json";
    try {
      expect(feedUrlFor("slf")).toBe("http://localhost:1/slf.json");
      expect(feedUrlFor("euregio")).toBe(PROVIDERS.euregio.feedUrl);
    } finally {
      delete process.env.AVALANCHE_SLF_FEED_URL;
    }
  });
});
