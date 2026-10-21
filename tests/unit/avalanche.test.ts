import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAvalancheData } from "@/lib/avalanche";
import {
  buildRegionIndex,
  isCurrent,
  resortStatuses,
} from "@/lib/avalanche/freshness";
import {
  normaliseBulletin,
  parseCaamlFeed,
  toPlainText,
} from "@/lib/avalanche/normalise";
import { PROVIDERS } from "@/lib/avalanche/providers";
import {
  regionIdsForPoints,
  type RegionFeature,
} from "@/lib/geo/assign-regions";
import {
  pointInMultiPolygon,
  pointInPolygon,
  type Polygon,
  type Ring,
} from "@/lib/geo/point-in-polygon";
import { getResorts } from "@/lib/resorts";
import {
  caamlBulletinSchema,
  type AvalancheBulletin,
} from "@/lib/schemas/avalanche";

const fixture = (name: string): { bulletins: Record<string, unknown>[] } =>
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "../fixtures/avalanche", name),
      "utf8",
    ),
  );

const euregio = fixture("euregio-latest-2026-05-02.json");
const tyrol = fixture("tyrol-2026-02-15.json");
const slf = fixture("slf-2026-02-15.json");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const quiet = () => vi.spyOn(console, "warn").mockImplementation(() => {});

describe("CAAML parsing: real Euregio bulletin (am/pm periods, split ratings)", () => {
  const bulletins = parseCaamlFeed(euregio, PROVIDERS.euregio);

  it("parses every bulletin and keeps regions, validity and provider attribution", () => {
    expect(bulletins).toHaveLength(5);
    const b = bulletins[0];
    expect(b.regionIds).toContain("IT-32-TN-13");
    expect(b.publicationTime).toBe("2026-05-02T15:00:00Z");
    expect(b.validUntil).toBe("2026-05-03T15:00:00Z");
    expect(b.provider).toMatchObject({ id: "euregio", license: "CC BY 4.0" });
    expect(b.sourceUrl).toBe("https://avalanche.report/");
  });

  it("maps wording to levels 1-5 and takes the maximum across ratings", () => {
    for (const b of bulletins) {
      const levels = b.dangerRatings.map((r) => r.level!);
      expect(b.maxDangerLevel).toBe(Math.max(...levels));
    }
    expect(bulletins.some((b) => b.maxDangerLevel === 2)).toBe(true);
  });

  it("keeps elevation-split ratings with numeric bounds", () => {
    const split = bulletins
      .flatMap((b) => b.dangerRatings)
      .filter((r) => r.elevation);
    expect(split.length).toBeGreaterThan(0);
    const bounds = split.flatMap((r) => Object.values(r.elevation!));
    expect(bounds.every((v) => typeof v === "number")).toBe(true);
  });

  it("keeps earlier / later time periods on ratings and problems", () => {
    expect(
      bulletins.flatMap((b) => b.dangerRatings).map((r) => r.validTimePeriod),
    ).toEqual(expect.arrayContaining(["earlier", "later"]));
    const problems = bulletins.flatMap((b) => b.problems);
    expect(problems.map((p) => p.type)).toEqual(
      expect.arrayContaining(["wet_snow", "persistent_weak_layers"]),
    );
    expect(problems.map((p) => p.validTimePeriod)).toEqual(
      expect.arrayContaining(["earlier", "later", "all_day"]),
    );
    expect(problems[0].aspects.length).toBeGreaterThan(0);
  });

  it("extracts plain-text highlights", () => {
    expect(bulletins[0].highlights).toMatch(/Weak layers/);
    expect(bulletins[0].highlights).not.toMatch(/[<>]/);
  });
});

describe("CAAML parsing: real Tyrol bulletin (treeline bounds)", () => {
  const bulletins = parseCaamlFeed(tyrol, PROVIDERS.euregio);

  it("parses all bulletins", () => expect(bulletins).toHaveLength(6));

  it("converts 'treeline' bounds and numeric bounds, in upper and lower position", () => {
    const bands = bulletins
      .flatMap((b) => [...b.problems, ...b.dangerRatings])
      .flatMap((x) => (x.elevation ? [x.elevation] : []));
    const values = bands.flatMap((e) => Object.values(e));
    expect(values).toContain("treeline");
    expect(values.some((v) => typeof v === "number")).toBe(true);
    expect(bands.some((e) => e.upperBound !== undefined)).toBe(true);
    expect(bands.some((e) => e.lowerBound !== undefined)).toBe(true);
  });

  it("represents an elevation-split rating as two entries with different levels", () => {
    const split = bulletins.find(
      (b) =>
        b.dangerRatings.length >= 2 &&
        new Set(b.dangerRatings.map((r) => r.level)).size >= 2,
    );
    expect(split).toBeDefined();
    expect(split!.maxDangerLevel).toBe(
      Math.max(...split!.dangerRatings.map((r) => r.level!)),
    );
  });
});

describe("CAAML parsing: real SLF bulletin", () => {
  const bulletins = parseCaamlFeed(slf, PROVIDERS.slf);

  it("attributes SLF as required by its licence", () => {
    expect(bulletins).toHaveLength(3);
    expect(bulletins[0].provider.name).toBe(
      "WSL Institute for Snow and Avalanche Research SLF",
    );
    expect(bulletins[0].provider.url).toBe("https://www.slf.ch/");
  });

  it("handles the shorter SLF validity window (ends the same afternoon)", () => {
    const b = bulletins[0];
    expect(
      Date.parse(b.validUntil) - Date.parse(b.publicationTime),
    ).toBeLessThan(24 * 3_600_000);
  });

  it("returns no bulletins for the empty out-of-season response", () => {
    expect(parseCaamlFeed(fixture("slf-empty.json"), PROVIDERS.slf)).toEqual(
      [],
    );
  });
});

describe("CAAML parsing: safe failure modes", () => {
  const good = () => structuredClone(euregio.bulletins[0]);
  const feed = (...bulletins: unknown[]) => ({ bulletins });

  it("throws on a response that is not a CAAML envelope", () => {
    expect(() => parseCaamlFeed({ foo: 1 }, PROVIDERS.slf)).toThrow();
    expect(() => parseCaamlFeed("<html>", PROVIDERS.slf)).toThrow();
  });

  it("drops a bulletin with a timestamp that has no offset (freshness could not be checked)", () => {
    quiet();
    const naive = { ...good(), publicationTime: "2026-02-14T18:51:00" };
    expect(parseCaamlFeed(feed(naive), PROVIDERS.euregio)).toEqual([]);
  });

  it("drops a bulletin with an unknown rating or problem instead of guessing", () => {
    quiet();
    const badRating = { ...good(), dangerRatings: [{ mainValue: "extreme" }] };
    const badProblem = {
      ...good(),
      avalancheProblems: [{ problemType: "dragons" }],
    };
    expect(
      parseCaamlFeed(feed(badRating, badProblem), PROVIDERS.euregio),
    ).toEqual([]);
  });

  it("keeps the valid bulletins when one entry is broken", () => {
    quiet();
    expect(
      parseCaamlFeed(
        feed(good(), { nonsense: true }, good()),
        PROVIDERS.euregio,
      ),
    ).toHaveLength(2);
  });

  it("never turns 'no_snow' / 'no_rating' into a danger level", () => {
    const raw = {
      ...good(),
      dangerRatings: [{ mainValue: "no_snow" }, { mainValue: "no_rating" }],
    };
    const [b] = parseCaamlFeed(feed(raw), PROVIDERS.euregio);
    expect(b.dangerRatings.map((r) => r.level)).toEqual([null, null]);
    expect(b.maxDangerLevel).toBeNull();
  });

  it("ignores no_snow when another rating exists", () => {
    const raw = {
      ...good(),
      dangerRatings: [{ mainValue: "no_snow" }, { mainValue: "considerable" }],
    };
    expect(parseCaamlFeed(feed(raw), PROVIDERS.euregio)[0].maxDangerLevel).toBe(
      3,
    );
  });

  it("strips markup from free text", () => {
    expect(toPlainText("<p>Wind <b>slabs</b>&nbsp;ahead</p>")).toBe(
      "Wind slabs &nbsp;ahead",
    );
    expect(toPlainText("   ")).toBeUndefined();
    const raw = {
      ...good(),
      avalancheActivity: { highlights: "<script>alert(1)</script>Take care" },
    };
    expect(
      parseCaamlFeed(feed(raw), PROVIDERS.euregio)[0].highlights,
    ).not.toMatch(/[<>]/);
  });

  it("schema accepts both Z and numeric offsets", () => {
    const base = good();
    expect(
      caamlBulletinSchema.safeParse({
        ...base,
        publicationTime: "2026-02-15T07:00:00+00:00",
      }).success,
    ).toBe(true);
    expect(
      caamlBulletinSchema.safeParse({
        ...base,
        publicationTime: "2026-02-15T08:00:00+01:00",
      }).success,
    ).toBe(true);
  });
});

describe("freshness rule (fake timers)", () => {
  // SLF-like: published 07:00Z, valid until 16:00Z the same day.
  const make = (over: Partial<AvalancheBulletin> = {}): AvalancheBulletin => ({
    ...normaliseBulletin(
      caamlBulletinSchema.parse(euregio.bulletins[0]),
      PROVIDERS.slf,
    ),
    publicationTime: "2026-02-15T07:00:00Z",
    validFrom: "2026-02-15T07:00:00Z",
    validUntil: "2026-02-16T07:00:00Z",
    ...over,
  });
  const at = (iso: string, b: AvalancheBulletin) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    return isCurrent(b, new Date());
  };

  it("is current inside the window and within 24 h", () => {
    expect(at("2026-02-15T12:00:00Z", make())).toBe(true);
  });

  it("is stale after the validity window ends, even if published less than 24 h ago", () => {
    const shortLived = make({ validUntil: "2026-02-15T16:00:00Z" });
    expect(at("2026-02-15T15:59:00Z", shortLived)).toBe(true);
    expect(at("2026-02-15T16:01:00Z", shortLived)).toBe(false);
  });

  it("is stale more than 24 h after publication even if the window is still open", () => {
    const longWindow = make({ validUntil: "2026-02-20T07:00:00Z" });
    expect(at("2026-02-16T07:00:00Z", longWindow)).toBe(true); // exactly 24 h
    expect(at("2026-02-16T07:00:01Z", longWindow)).toBe(false);
  });

  it("is not current before it becomes valid", () => {
    expect(
      at("2026-02-15T06:00:00Z", make({ validFrom: "2026-02-15T17:00:00Z" })),
    ).toBe(false);
  });

  it("rejects a publication time in the future beyond clock skew", () => {
    const future = make({
      publicationTime: "2026-02-15T13:00:00Z",
      validFrom: "2026-02-15T06:00:00Z",
    });
    expect(at("2026-02-15T12:00:00Z", future)).toBe(false);
    expect(at("2026-02-15T12:50:00Z", future)).toBe(true);
  });

  it("treats unparsable times as not current", () => {
    expect(at("2026-02-15T12:00:00Z", make({ validUntil: "garbage" }))).toBe(
      false,
    );
  });

  it("real case: last season's final bulletin (2 May) is stale today and current on its own day", () => {
    const [b] = parseCaamlFeed(euregio, PROVIDERS.euregio);
    expect(at("2026-10-21T10:00:00Z", b)).toBe(false);
    expect(at("2026-05-02T18:00:00Z", b)).toBe(true);
    expect(at("2026-05-03T14:59:00Z", b)).toBe(true);
    expect(at("2026-05-03T15:01:00Z", b)).toBe(false);
  });
});

describe("region index", () => {
  const all = parseCaamlFeed(tyrol, PROVIDERS.euregio);
  const day = new Date("2026-02-15T10:00:00Z");

  it("marks bulletins current or stale per region and leaves unknown regions out", () => {
    const index = buildRegionIndex(all, day);
    expect(index.get("AT-07-07")?.state).toBe("current");
    expect(index.has("XX-00")).toBe(false);
    const later = buildRegionIndex(all, new Date("2026-10-21T10:00:00Z"));
    expect([...later.values()].every((s) => s.state === "stale")).toBe(true);
  });

  it("prefers the newest published bulletin, and a current one over a stale one", () => {
    const base = all[0];
    const older = {
      ...base,
      bulletinId: "old",
      publicationTime: "2026-02-15T05:00:00Z",
      maxDangerLevel: 2 as const,
    };
    const newer = {
      ...base,
      bulletinId: "new",
      publicationTime: "2026-02-15T08:00:00Z",
      maxDangerLevel: 3 as const,
    };
    const stale = {
      ...base,
      bulletinId: "stale",
      publicationTime: "2026-02-10T08:00:00Z",
      validUntil: "2026-02-11T08:00:00Z",
    };
    const region = base.regionIds[0];
    const pick = (list: AvalancheBulletin[]) =>
      buildRegionIndex(list, day).get(region)!.bulletin.bulletinId;
    expect(pick([older, newer])).toBe("new");
    expect(pick([newer, older])).toBe("new");
    expect(pick([stale, older])).toBe("old");
    expect(pick([older, stale])).toBe("old");
  });

  it("orders a resort's regions with current and most dangerous first", () => {
    const index = buildRegionIndex(all, day);
    const ids = ["AT-07-07", "XX-00", ...all[0].regionIds.slice(0, 3)];
    const statuses = resortStatuses(ids, index);
    expect(statuses.length).toBeGreaterThan(0);
    const levels = statuses.map((s) => s.bulletin.maxDangerLevel ?? 0);
    expect(levels).toEqual([...levels].sort((a, b) => b - a));
  });
});

describe("geometry and region assignment", () => {
  const square: Polygon = [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ];
  const withHole: Polygon = [
    ...square,
    [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ],
  ];

  it("detects points inside, outside and in holes", () => {
    expect(pointInPolygon({ lon: 2, lat: 2 }, square)).toBe(true);
    expect(pointInPolygon({ lon: 12, lat: 2 }, square)).toBe(false);
    expect(pointInPolygon({ lon: 5, lat: 5 }, withHole)).toBe(false);
    expect(pointInPolygon({ lon: 2, lat: 5 }, withHole)).toBe(true);
    expect(
      pointInMultiPolygon({ lon: 15, lat: 5 }, [
        square,
        [
          [
            [14, 0],
            [20, 0],
            [20, 10],
            [14, 10],
            [14, 0],
          ],
        ],
      ]),
    ).toBe(true);
  });

  const feature = (
    id: string,
    start: string | null,
    end: string | null,
    ring: Ring = square[0],
  ): RegionFeature => ({
    properties: { id, start_date: start, end_date: end },
    geometry: { type: "Polygon", coordinates: [ring] },
  });

  it("only uses polygons valid on the given day and combines several points", () => {
    const features = [
      feature("OLD-1", "2020-01-01", "2025-07-31"),
      feature("NEW-1", "2025-08-01", null),
      feature("OTHER", null, null, [
        [20, 20],
        [30, 20],
        [30, 30],
        [20, 30],
        [20, 20],
      ]),
    ];
    expect(
      regionIdsForPoints([{ lon: 5, lat: 5 }], features, "2026-10-21"),
    ).toEqual(["NEW-1"]);
    expect(
      regionIdsForPoints([{ lon: 5, lat: 5 }], features, "2024-01-01"),
    ).toEqual(["OLD-1"]);
    expect(
      regionIdsForPoints(
        [
          { lon: 5, lat: 5 },
          { lon: 25, lat: 25 },
        ],
        features,
        "2026-10-21",
      ),
    ).toEqual(["NEW-1", "OTHER"]);
    expect(
      regionIdsForPoints([{ lon: 50, lat: 50 }], features, "2026-10-21"),
    ).toEqual([]);
  });
});

describe("resort region assignment (seed data)", () => {
  const resorts = getResorts();
  const bySlug = Object.fromEntries(resorts.map((r) => [r.slug, r]));
  const tyrolIds = new Set(
    tyrol.bulletins.flatMap((b) =>
      (b.regions as { regionID: string }[]).map((r) => r.regionID),
    ),
  );

  it("assigns well-formed EAWS ids", () => {
    for (const r of resorts) {
      for (const id of r.avalancheRegionIds)
        expect(id, r.slug).toMatch(/^[A-Z]{2}-/);
    }
  });

  it("leaves resorts without an EAWS service empty (Bulgaria, Georgia)", () => {
    expect(bySlug.bansko.avalancheRegionIds).toEqual([]);
    expect(bySlug.gudauri.avalancheRegionIds).toEqual([]);
  });

  it("maps the Tatras and Tyrol correctly", () => {
    expect(bySlug["kasprowy-wierch"].avalancheRegionIds).toContain("PL-12");
    for (const slug of [
      "st-anton",
      "fieberbrunn",
      "hintertux",
      "soelden",
      "obergurgl",
      "ischgl",
      "kuehtai",
    ]) {
      const ids = bySlug[slug].avalancheRegionIds;
      expect(ids.length, slug).toBeGreaterThan(0);
      expect(
        ids.every((id) => id.startsWith("AT-07-")),
        slug,
      ).toBe(true);
      // The assigned ids really exist in a recorded Tyrol bulletin, so the join will work live.
      expect(
        ids.some((id) => tyrolIds.has(id)),
        slug,
      ).toBe(true);
    }
  });

  it("maps Swiss resorts to CH regions served by SLF", () => {
    for (const slug of [
      "verbier",
      "engelberg",
      "andermatt",
      "st-moritz",
      "zermatt",
      "disentis",
    ]) {
      expect(
        bySlug[slug].avalancheRegionIds.every((id) => id.startsWith("CH-")),
        slug,
      ).toBe(true);
      expect(bySlug[slug].avalancheRegionIds.length, slug).toBeGreaterThan(0);
    }
  });
});

describe("getAvalancheData", () => {
  const route = (map: Record<string, unknown>) =>
    vi.fn(async (url: string | URL) => {
      const body = map[String(url)];
      return body === undefined
        ? new Response("down", { status: 503 })
        : Response.json(body);
    });

  it("indexes live bulletins from both providers", async () => {
    vi.stubGlobal(
      "fetch",
      route({
        [PROVIDERS.euregio.feedUrl]: tyrol,
        [PROVIDERS.slf.feedUrl]: slf,
      }),
    );
    const data = await getAvalancheData(new Date("2026-02-15T10:00:00Z"));
    expect(data.feeds.euregio).toEqual({ state: "live", count: 6 });
    expect(data.feeds.slf).toEqual({ state: "live", count: 3 });
    expect(data.index.get("AT-07-07")?.state).toBe("current");
    expect(data.index.get("CH-6112")?.state).toBe("current");
  });

  it("shows nothing for a feed that is down, with no invented data", async () => {
    quiet();
    vi.stubGlobal("fetch", route({ [PROVIDERS.slf.feedUrl]: slf }));
    const data = await getAvalancheData(new Date("2026-02-15T10:00:00Z"));
    expect(data.feeds.euregio).toEqual({ state: "unavailable", count: 0 });
    expect(data.index.get("AT-07-07")).toBeUndefined();
    expect(data.index.get("CH-6112")?.state).toBe("current");
  });

  it("marks last season's data stale and the empty SLF feed as live with 0 bulletins (today)", async () => {
    vi.stubGlobal(
      "fetch",
      route({
        [PROVIDERS.euregio.feedUrl]: euregio,
        [PROVIDERS.slf.feedUrl]: fixture("slf-empty.json"),
      }),
    );
    const data = await getAvalancheData(new Date("2026-10-21T10:00:00Z"));
    expect(data.feeds.slf).toEqual({ state: "live", count: 0 });
    expect(data.feeds.euregio.count).toBe(5);
    expect([...data.index.values()].every((s) => s.state === "stale")).toBe(
      true,
    );
  });

  it("never fabricates data when the network is blocked or mock mode is forced", async () => {
    quiet();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    const offline = await getAvalancheData();
    expect(offline.index.size).toBe(0);
    expect(offline.feeds.euregio.state).toBe("unavailable");

    // FORCE_MOCK_DATA does not apply here: there is no mock, so it still tries the source and fails to "no data".
    vi.stubEnv("FORCE_MOCK_DATA", "1");
    const forced = await getAvalancheData();
    expect(forced.index.size).toBe(0);
    expect(forced.feeds.slf.state).toBe("unavailable");
  });

  it("treats a malformed response as an outage", async () => {
    quiet();
    vi.stubGlobal(
      "fetch",
      route({
        [PROVIDERS.euregio.feedUrl]: { not: "caaml" },
        [PROVIDERS.slf.feedUrl]: slf,
      }),
    );
    const data = await getAvalancheData(new Date("2026-02-15T10:00:00Z"));
    expect(data.feeds.euregio.state).toBe("unavailable");
    expect(data.feeds.slf.state).toBe("live");
  });
});
