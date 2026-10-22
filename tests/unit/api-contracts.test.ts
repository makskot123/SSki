import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  avalancheResponseSchema,
  buildAvalancheResponse,
  buildForecastsResponse,
  buildResortsResponse,
  forecastsResponseSchema,
  resortsResponseSchema,
} from "@/lib/api/contracts";
import { buildRegionIndex } from "@/lib/avalanche/freshness";
import { parseCaamlFeed } from "@/lib/avalanche/normalise";
import { PROVIDERS } from "@/lib/avalanche/providers";
import { getResorts } from "@/lib/resorts";
import { mockForecast } from "@/lib/weather/mock";

const load = (name: string) =>
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "../fixtures/avalanche", name),
      "utf8",
    ),
  );
const bulletins = [
  ...parseCaamlFeed(load("tyrol-2026-02-15.json"), PROVIDERS.euregio),
  ...parseCaamlFeed(load("slf-2026-02-15.json"), PROVIDERS.slf),
];
const live = {
  euregio: { state: "live" as const, count: 6 },
  slf: { state: "live" as const, count: 3 },
};
const DAY = new Date("2026-02-15T10:00:00Z");
const LATER = new Date("2026-10-21T10:00:00Z");
const roundTrip = <T>(x: T): unknown => JSON.parse(JSON.stringify(x));

describe("/api/v1/resorts contract", () => {
  it("contains all resorts and validates", () => {
    const body = buildResortsResponse(getResorts(), DAY);
    expect(body.resorts).toHaveLength(30);
    expect(resortsResponseSchema.safeParse(roundTrip(body)).success).toBe(true);
  });

  it("rejects unknown top-level fields and wrong versions", () => {
    const body = buildResortsResponse(getResorts(), DAY);
    expect(resortsResponseSchema.safeParse({ ...body, extra: 1 }).success).toBe(
      false,
    );
    expect(
      resortsResponseSchema.safeParse({ ...body, version: 2 }).success,
    ).toBe(false);
  });
});

describe("/api/v1/forecasts contract", () => {
  const forecasts = getResorts().map((r) =>
    mockForecast(r, new Date("2026-01-15T10:00:00Z")),
  );

  it("labels sample data as mock and strips every alert from it", () => {
    // Winter mock data does produce alerts sometimes; the API must not pass them on.
    expect(forecasts.some((f) => f.powderAlarm || f.windWarning)).toBe(true);
    const body = buildForecastsResponse(forecasts, "mock", DAY);
    expect(body.status).toBe("mock");
    expect(
      body.forecasts.every(
        (f) => f.dataStatus === "mock" && !f.powderAlarm && !f.windWarning,
      ),
    ).toBe(true);
    expect(forecastsResponseSchema.safeParse(roundTrip(body)).success).toBe(
      true,
    );
    expect(body.attribution).toMatch(/Open-Meteo/);
  });

  it("refuses a response where sample data carries an alert or statuses disagree", () => {
    const body = buildForecastsResponse(forecasts, "mock", DAY);
    const withAlarm = {
      ...body,
      forecasts: [{ ...body.forecasts[0], powderAlarm: true }],
    };
    expect(
      forecastsResponseSchema.safeParse(roundTrip(withAlarm)).success,
    ).toBe(false);
    const mixed = { ...body, status: "live" };
    expect(forecastsResponseSchema.safeParse(roundTrip(mixed)).success).toBe(
      false,
    );
  });

  it("keeps live alerts", () => {
    const liveForecasts = forecasts.map((f) => ({
      ...f,
      dataStatus: "live" as const,
    }));
    const body = buildForecastsResponse(liveForecasts, "live", DAY);
    expect(body.forecasts.some((f) => f.powderAlarm || f.windWarning)).toBe(
      true,
    );
    expect(forecastsResponseSchema.safeParse(roundTrip(body)).success).toBe(
      true,
    );
  });
});

describe("/api/v1/avalanche contract", () => {
  it("current regions carry a level and their bulletin; the response validates", () => {
    const body = buildAvalancheResponse(
      { index: buildRegionIndex(bulletins, DAY), feeds: live },
      DAY,
    );
    const entry = body.regions["AT-07-07"];
    expect(entry).toMatchObject({ state: "current" });
    if (entry.state === "current") {
      expect(entry.level).toBeGreaterThan(0);
      expect(body.bulletins.map((b) => b.bulletinId)).toContain(
        entry.bulletinId,
      );
    }
    expect(avalancheResponseSchema.safeParse(roundTrip(body)).success).toBe(
      true,
    );
    expect(body.attribution.join(" ")).toMatch(
      /WSL Institute for Snow and Avalanche Research SLF/,
    );
  });

  it("SAFETY: stale regions carry no level and stale bulletins are not sent at all", () => {
    const body = buildAvalancheResponse(
      { index: buildRegionIndex(bulletins, LATER), feeds: live },
      LATER,
    );
    const entries = Object.values(body.regions);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.state).toBe("stale");
      expect(e).not.toHaveProperty("level");
    }
    expect(body.bulletins).toEqual([]);
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/"level"\s*:/);
    expect(text).not.toMatch(/maxDangerLevel/);
    expect(avalancheResponseSchema.safeParse(roundTrip(body)).success).toBe(
      true,
    );
  });

  it("SAFETY: re-checks freshness at build time even if the index still says current", () => {
    const index = buildRegionIndex(bulletins, DAY); // built when current...
    const body = buildAvalancheResponse(
      { index, feeds: live },
      new Date("2026-02-17T10:00:00Z"),
    ); // ...sent later
    expect(Object.values(body.regions).every((e) => e.state === "stale")).toBe(
      true,
    );
    expect(body.bulletins).toEqual([]);
  });

  it("the schema rejects a stale region that carries a level, or a current one without its bulletin", () => {
    const body = buildAvalancheResponse(
      { index: buildRegionIndex(bulletins, DAY), feeds: live },
      DAY,
    );
    const id = Object.keys(body.regions)[0];
    const sneaky = {
      ...body,
      regions: {
        ...body.regions,
        [id]: { state: "stale", publishedAt: DAY.toISOString(), level: 3 },
      },
    };
    expect(avalancheResponseSchema.safeParse(roundTrip(sneaky)).success).toBe(
      false,
    );
    const orphan = { ...body, bulletins: [] };
    expect(avalancheResponseSchema.safeParse(roundTrip(orphan)).success).toBe(
      false,
    );
  });

  it("reports feeds that are down and still validates with no data", () => {
    const body = buildAvalancheResponse(
      {
        index: new Map(),
        feeds: {
          euregio: { state: "unavailable", count: 0 },
          slf: { state: "unavailable", count: 0 },
        },
      },
      DAY,
    );
    expect(body.regions).toEqual({});
    expect(body.feeds.euregio.state).toBe("unavailable");
    expect(avalancheResponseSchema.safeParse(roundTrip(body)).success).toBe(
      true,
    );
  });
});
