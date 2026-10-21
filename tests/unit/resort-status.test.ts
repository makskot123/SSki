import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildRegionIndex } from "@/lib/avalanche/freshness";
import { metaName, regionMeta, servicesFor } from "@/lib/avalanche/meta";
import { parseCaamlFeed } from "@/lib/avalanche/normalise";
import { PROVIDERS, providerFor } from "@/lib/avalanche/providers";
import {
  resortAvalanche,
  summariseResort,
} from "@/lib/avalanche/resort-status";
import { downgradeExpired, toView } from "@/lib/avalanche/view";
import { getResortBySlug, getResorts } from "@/lib/resorts";

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
const live = {
  euregio: { state: "live" as const },
  slf: { state: "live" as const },
};
const index = buildRegionIndex([...tyrol, ...slf], day);
const resort = (slug: string) => getResortBySlug(slug)!;
const status = (slug: string) =>
  resortAvalanche(resort(slug), index, live, (id) => id);

describe("providerFor (which feed covers a region)", () => {
  it("maps Tyrol, South Tyrol, Trentino and Switzerland to their feeds, others to null", () => {
    expect(providerFor("AT-07-07")).toBe("euregio");
    expect(providerFor("IT-32-BZ-03")).toBe("euregio");
    expect(providerFor("IT-32-TN-13")).toBe("euregio");
    expect(providerFor("CH-4115")).toBe("slf");
    expect(providerFor("AT-05-05")).toBeNull(); // Salzburg: link out
    expect(providerFor("AT-070")).toBeNull();
    expect(providerFor("IT-25-SO-03")).toBeNull();
    expect(providerFor("FR-03")).toBeNull();
    expect(providerFor("PL-12")).toBeNull();
  });

  it("agrees with the recorded feeds: every region they publish is covered by that provider", () => {
    for (const b of tyrol)
      for (const id of b.regionIds) expect(providerFor(id), id).toBe("euregio");
    for (const b of slf)
      for (const id of b.regionIds) expect(providerFor(id), id).toBe("slf");
  });
});

describe("resortAvalanche", () => {
  it("covered + current bulletin (Tyrol, Switzerland)", () => {
    for (const slug of ["st-anton", "verbier"]) {
      const s = status(slug);
      expect(s.kind, slug).toBe("covered");
      if (s.kind !== "covered") continue;
      expect(
        s.regions.every((r) => r.state === "current"),
        slug,
      ).toBe(true);
      const sum = summariseResort(s.regions, day);
      expect(sum.state, slug).toBe("current");
      expect(sum.maxLevel, slug).toBeGreaterThan(0);
    }
  });

  it("covered but the feed has no bulletin for the region (Disentis)", () => {
    const s = status("disentis");
    expect(s.kind).toBe("covered");
    if (s.kind !== "covered") return;
    expect(s.regions.map((r) => r.state)).toEqual(["missing"]);
    expect(summariseResort(s.regions, day)).toMatchObject({
      state: "missing",
      maxLevel: null,
    });
  });

  it("a resort spanning two regions uses the highest CURRENT level and keeps both", () => {
    const s = status("andermatt");
    if (s.kind !== "covered") throw new Error("expected covered");
    expect(s.regions.map((r) => r.state).sort()).toEqual([
      "current",
      "missing",
    ]);
    const sum = summariseResort(s.regions, day);
    expect(sum.state).toBe("current");
    expect(sum.current).toHaveLength(1);
  });

  it("only links out for regions no feed covers (France, Poland, Salzburg, Lombardy)", () => {
    for (const slug of [
      "chamonix",
      "kasprowy-wierch",
      "bad-gastein",
      "livigno",
    ]) {
      expect(status(slug).kind, slug).toBe("not_covered");
    }
  });

  it("has no service at all for Bulgaria and Georgia", () => {
    expect(status("bansko").kind).toBe("no_service");
    expect(status("gudauri").kind).toBe("no_service");
  });

  it("is stale (never a level) once the bulletins are out of date", () => {
    const later = new Date("2026-10-21T10:00:00Z");
    const s = resortAvalanche(
      resort("st-anton"),
      buildRegionIndex([...tyrol, ...slf], later),
      live,
      (id) => id,
    );
    if (s.kind !== "covered") throw new Error("expected covered");
    expect(s.regions.map((r) => r.state)).toEqual(["stale"]);
    expect(summariseResort(s.regions, later)).toMatchObject({
      state: "stale",
      maxLevel: null,
      current: [],
    });
  });

  it("re-checks freshness at display time: a region marked current but expired is stale", () => {
    const s = status("st-anton");
    if (s.kind !== "covered") throw new Error("expected covered");
    expect(summariseResort(s.regions, day).state).toBe("current");
    expect(
      summariseResort(s.regions, new Date("2026-02-16T20:00:00Z")).state,
    ).toBe("stale");
  });

  it("reports which feeds are down", () => {
    const s = resortAvalanche(
      resort("verbier"),
      new Map(),
      { ...live, slf: { state: "unavailable" } },
      (id) => id,
    );
    expect(s).toMatchObject({ kind: "covered", feedsDown: ["slf"] });
    if (s.kind === "covered") expect(s.regions[0].state).toBe("missing");
  });

  it("puts every resort in the seed into exactly one kind", () => {
    const counts = { no_service: 0, not_covered: 0, covered: 0 };
    for (const r of getResorts())
      counts[resortAvalanche(r, new Map(), live, (id) => id).kind]++;
    expect(counts).toEqual({ no_service: 2, not_covered: 15, covered: 13 });
  });
});

describe("downgradeExpired (browser-side freshness check)", () => {
  const view = toView(buildRegionIndex([...tyrol, ...slf], day));

  it("returns the very same object when nothing expired", () => {
    expect(downgradeExpired(view, day)).toBe(view);
  });

  it("turns expired regions into stale, keeping the data", () => {
    const next = downgradeExpired(view, new Date("2026-02-17T00:00:00Z"));
    expect(next).not.toBe(view);
    expect(Object.values(next.regions).every((e) => e.state === "stale")).toBe(
      true,
    );
    expect(next.bulletins).toBe(view.bulletins);
  });

  it("never upgrades stale to current, even with a clock set back", () => {
    const stale = toView(
      buildRegionIndex([...tyrol], new Date("2026-10-21T10:00:00Z")),
    );
    expect(downgradeExpired(stale, day)).toBe(stale);
    expect(
      Object.values(downgradeExpired(stale, day).regions).every(
        (e) => e.state === "stale",
      ),
    ).toBe(true);
  });
});

describe("region meta", () => {
  it("has names and official services for regions we link out to", () => {
    expect(metaName(regionMeta, "FR-03", "en")).toBeTruthy();
    expect(
      servicesFor(regionMeta, "FR-03")
        .map((s) => s.name)
        .join(),
    ).toMatch(/Meteo/i);
    expect(servicesFor(regionMeta, "PL-12").length).toBeGreaterThan(0);
    expect(servicesFor(regionMeta, "XX-99")).toEqual([]);
  });

  it("knows every resort region", () => {
    for (const r of getResorts()) {
      for (const id of r.avalancheRegionIds)
        expect(regionMeta.regions[id], `${r.slug} ${id}`).toBeDefined();
    }
  });
});
