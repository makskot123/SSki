import { describe, expect, it } from "vitest";
import raw from "@/data/resorts.json";
import { getResortBySlug, getResorts } from "@/lib/resorts";
import { resortSchema, resortsSchema } from "@/lib/schemas/resort";

const first = () => structuredClone(raw[0]);

describe("resort seed data", () => {
  it("contains 30 valid resorts", () => {
    expect(resortsSchema.safeParse(raw).success).toBe(true);
    expect(getResorts()).toHaveLength(30);
  });

  it("has unique slugs", () => {
    const slugs = getResorts().map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has vertical drop equal to top minus bottom", () => {
    for (const r of getResorts()) {
      expect(r.verticalDrop, r.slug).toBe(r.elevation.top - r.elevation.bottom);
    }
  });

  it("has coordinates inside Europe/Caucasus and a summit point near the base", () => {
    for (const r of getResorts()) {
      expect(r.coordinates.lat, r.slug).toBeGreaterThan(40);
      expect(r.coordinates.lat, r.slug).toBeLessThan(70);
      expect(r.coordinates.lon, r.slug).toBeGreaterThan(5);
      expect(r.coordinates.lon, r.slug).toBeLessThan(46);
      const dLat = Math.abs(r.coordinates.lat - r.summitPoint.lat);
      const dLon = Math.abs(r.coordinates.lon - r.summitPoint.lon);
      expect(
        Math.max(dLat, dLon),
        `${r.slug} summit far from base`,
      ).toBeLessThan(0.15);
    }
  });

  it("covers every resort named in the project brief", () => {
    for (const slug of [
      "chamonix",
      "verbier",
      "la-grave",
      "kasprowy-wierch",
      "jasna",
      "bansko",
      "gudauri",
    ]) {
      expect(getResortBySlug(slug), slug).toBeDefined();
    }
  });

  it("only links over https", () => {
    for (const r of getResorts()) {
      expect(r.links.official.startsWith("https://"), r.slug).toBe(true);
      if (r.links.avalancheBulletin) {
        expect(r.links.avalancheBulletin.startsWith("https://"), r.slug).toBe(
          true,
        );
      }
    }
  });
});

describe("resort schema rejects bad data", () => {
  it("rejects a wrong vertical drop", () => {
    const bad = first();
    bad.verticalDrop += 100;
    expect(resortSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects duplicate slugs", () => {
    expect(resortsSchema.safeParse([first(), first()]).success).toBe(false);
  });

  it("rejects unknown fields (typos)", () => {
    const bad = { ...first(), elevaton: 1 };
    expect(resortSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a summit elevation above the top", () => {
    const bad = first();
    bad.summitPoint.elevation = bad.elevation.top + 1;
    expect(resortSchema.safeParse(bad).success).toBe(false);
  });
});
