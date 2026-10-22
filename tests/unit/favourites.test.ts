import { describe, expect, it } from "vitest";
import { parseFavourites, toggleFavourite } from "@/lib/favourites";
import { distanceKm, nearest } from "@/lib/geo/distance";

const KNOWN = ["chamonix", "verbier", "zermatt"];

describe("favourites", () => {
  it("keeps only known slugs, in saved order, without duplicates", () => {
    expect(
      parseFavourites('["zermatt","nope","chamonix","zermatt",3]', KNOWN),
    ).toEqual(["zermatt", "chamonix"]);
  });

  it("ignores missing or corrupt storage", () => {
    expect(parseFavourites(null, KNOWN)).toEqual([]);
    expect(parseFavourites("{oops", KNOWN)).toEqual([]);
    expect(parseFavourites('{"a":1}', KNOWN)).toEqual([]);
  });

  it("toggles a slug in and out", () => {
    expect(toggleFavourite(["verbier"], "zermatt")).toEqual([
      "verbier",
      "zermatt",
    ]);
    expect(toggleFavourite(["verbier", "zermatt"], "verbier")).toEqual([
      "zermatt",
    ]);
  });
});

describe("distance", () => {
  const innsbruck = { lat: 47.2692, lon: 11.4041 };
  const zurich = { lat: 47.3769, lon: 8.5417 };

  it("is about 216 km from Innsbruck to Zurich, and symmetric", () => {
    expect(distanceKm(innsbruck, zurich)).toBeCloseTo(216, -1);
    expect(distanceKm(zurich, innsbruck)).toBeCloseTo(
      distanceKm(innsbruck, zurich),
      9,
    );
    expect(distanceKm(zurich, zurich)).toBe(0);
  });

  it("returns the nearest items first", () => {
    const places = [
      { id: "zurich", ...zurich },
      { id: "innsbruck", ...innsbruck },
      { id: "vienna", lat: 48.2082, lon: 16.3738 },
    ];
    const result = nearest(places, { lat: 47.3, lon: 11 }, (p) => p, 2);
    expect(result.map((r) => r.item.id)).toEqual(["innsbruck", "zurich"]);
    expect(result[0].km).toBeLessThan(result[1].km);
  });
});
