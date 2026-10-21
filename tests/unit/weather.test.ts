import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithFallback } from "@/lib/fetch-with-fallback";
import { getResorts } from "@/lib/resorts";
import {
  degToCompass,
  hasWindWarning,
  isPowderAlarm,
  snowOnDates,
  toSnowForecast,
  weekendDates,
} from "@/lib/weather/map";
import { mockForecast } from "@/lib/weather/mock";
import {
  buildForecastUrl,
  forecastSchemaFor,
  openMeteoResponseSchema,
  type OpenMeteoLocation,
} from "@/lib/weather/open-meteo";
import { getForecasts } from "@/lib/weather";
import { POWDER_ALARM_CM, WIND_WARNING_KMH } from "@/lib/weather/thresholds";
import type { SnowForecastDay } from "@/lib/weather/types";
import { z } from "zod";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const resorts = getResorts();
const NOW = new Date("2026-10-21T12:00:00Z"); // a Wednesday

/** Raw Open-Meteo-shaped location: 3 past days + 7 forecast days, like past_days=3&forecast_days=7. */
function rawLocation(
  opts: {
    hourlySnow?: (isoHour: string) => number | null;
    gust?: (date: string) => number | null;
    wind?: (date: string) => number | null;
    dailySnow?: (date: string) => number | null;
  } = {},
): OpenMeteoLocation {
  const start = Date.parse("2026-10-18T00:00:00Z");
  const hours = Array.from({ length: 240 }, (_, i) =>
    new Date(start + i * 3_600_000).toISOString().slice(0, 16),
  );
  const dates = Array.from({ length: 10 }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
  return {
    hourly: {
      time: hours,
      snowfall: hours.map((h) => (opts.hourlySnow ? opts.hourlySnow(h) : 0)),
      freezing_level_height: hours.map(() => 2000),
    },
    daily: {
      time: dates,
      snowfall_sum: dates.map((d) => (opts.dailySnow ? opts.dailySnow(d) : 0)),
      temperature_2m_max: dates.map(() => -2),
      temperature_2m_min: dates.map(() => -8),
      wind_speed_10m_max: dates.map((d) => (opts.wind ? opts.wind(d) : 30)),
      wind_gusts_10m_max: dates.map((d) => (opts.gust ? opts.gust(d) : 40)),
      wind_direction_10m_dominant: dates.map(() => 270),
    },
  };
}

describe("thresholds", () => {
  it("powder alarm triggers at exactly 20 cm in 48 h, not below", () => {
    expect(POWDER_ALARM_CM).toBe(20);
    expect(isPowderAlarm(19.9)).toBe(false);
    expect(isPowderAlarm(20)).toBe(true);
    expect(isPowderAlarm(45)).toBe(true);
  });

  const day = (date: string, wind: number, gust = 150): SnowForecastDay => ({
    date,
    snowfallCm: 0,
    freezingLevelM: 2000,
    tempMinC: -5,
    tempMaxC: 0,
    windMaxKmh: wind,
    windGustKmh: gust,
    windDirectionDeg: 270,
  });

  it("wind warning triggers at 40 km/h sustained wind within the first 3 days only", () => {
    expect(WIND_WARNING_KMH).toBe(40);
    const calm = [day("a", 39), day("b", 20), day("c", 10)];
    expect(hasWindWarning(calm)).toBe(false);
    expect(hasWindWarning([day("a", 20), day("b", 40), day("c", 10)])).toBe(
      true,
    );
    // a storm on day 4 is outside the window
    expect(hasWindWarning([...calm, day("d", 90)])).toBe(false);
  });

  it("ignores gusts, which are routinely extreme on high summits", () => {
    expect(
      hasWindWarning([day("a", 20, 140), day("b", 25, 150), day("c", 10, 130)]),
    ).toBe(false);
  });
});

describe("toSnowForecast", () => {
  const resort = resorts[0];

  it("sums the last 72 h and the next 48 h around `now`", () => {
    // 1 cm every hour: past window (now-72h, now] = 72 h, next window (now, now+48h] = 48 h
    const f = toSnowForecast(
      rawLocation({ hourlySnow: () => 1 }),
      resort,
      NOW,
      "live",
    );
    expect(f.past72hSnowfallCm).toBe(72);
    expect(f.next48hSnowfallCm).toBe(48);
    expect(f.powderAlarm).toBe(true);
  });

  it("does not raise the alarm for light snow", () => {
    // 0.4 cm/h in the next 48 h = 19.2 cm
    const future = (h: string) =>
      Date.parse(`${h}Z`) > NOW.getTime() ? 0.4 : 0;
    const f = toSnowForecast(
      rawLocation({ hourlySnow: future }),
      resort,
      NOW,
      "live",
    );
    expect(f.next48hSnowfallCm).toBe(19.2);
    expect(f.powderAlarm).toBe(false);
  });

  it("starts the daily list today and keeps at most 7 days", () => {
    const f = toSnowForecast(rawLocation(), resort, NOW, "live");
    expect(f.days).toHaveLength(7);
    expect(f.days[0].date).toBe("2026-10-21");
    expect(f.days[6].date).toBe("2026-10-27");
  });

  it("flags wind only from the next 3 days", () => {
    const stormOnDay5 = rawLocation({
      wind: (d) => (d === "2026-10-25" ? 70 : 30),
    });
    expect(toSnowForecast(stormOnDay5, resort, NOW, "live").windWarning).toBe(
      false,
    );
    const stormTomorrow = rawLocation({
      wind: (d) => (d === "2026-10-22" ? 55 : 30),
    });
    expect(toSnowForecast(stormTomorrow, resort, NOW, "live").windWarning).toBe(
      true,
    );
  });

  it("treats missing hourly snow as 0 and drops days with missing values", () => {
    const loc = rawLocation({
      hourlySnow: () => null,
      wind: (d) => (d === "2026-10-23" ? null : 30),
    });
    const f = toSnowForecast(loc, resort, NOW, "live");
    expect(f.past72hSnowfallCm).toBe(0);
    expect(f.days.map((d) => d.date)).not.toContain("2026-10-23");
  });

  it("averages the freezing level per day and uses the summit elevation", () => {
    const f = toSnowForecast(rawLocation(), resort, NOW, "live");
    expect(f.days[0].freezingLevelM).toBe(2000);
    expect(f.elevationM).toBe(resort.summitPoint.elevation);
    expect(f.dataStatus).toBe("live");
  });
});

describe("weekend helpers", () => {
  const w = (iso: string) => weekendDates(new Date(`${iso}T09:00:00Z`));
  it("returns Fri-Sun for Monday to Friday", () => {
    expect(w("2026-10-19")).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]); // Mon
    expect(w("2026-10-21")).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]); // Wed
    expect(w("2026-10-23")).toEqual(["2026-10-23", "2026-10-24", "2026-10-25"]); // Fri
  });
  it("shrinks to the remaining days on Saturday and Sunday", () => {
    expect(w("2026-10-24")).toEqual(["2026-10-24", "2026-10-25"]);
    expect(w("2026-10-25")).toEqual(["2026-10-25"]);
  });

  it("sums snow on the given dates and reports an incomplete forecast", () => {
    const f = toSnowForecast(
      rawLocation({ dailySnow: () => 5 }),
      resorts[0],
      NOW,
      "live",
    );
    expect(snowOnDates(f, weekendDates(NOW))).toEqual({
      cm: 15,
      complete: true,
    });
    expect(snowOnDates(f, ["2026-10-27", "2026-10-28"])).toEqual({
      cm: 5,
      complete: false,
    });
  });

  it("converts degrees to the compass point the wind comes from", () => {
    expect(degToCompass(0)).toBe("N");
    expect(degToCompass(359)).toBe("N");
    expect(degToCompass(90)).toBe("E");
    expect(degToCompass(225)).toBe("SW");
    expect(degToCompass(-45)).toBe("NW");
  });
});

describe("Open-Meteo request and response", () => {
  it("builds one request for all resorts at summit elevation", () => {
    const url = new URL(buildForecastUrl(resorts));
    expect(url.hostname).toBe("api.open-meteo.com");
    expect(url.searchParams.get("latitude")?.split(",")).toHaveLength(
      resorts.length,
    );
    expect(url.searchParams.get("elevation")?.split(",").map(Number)).toEqual(
      resorts.map((r) => r.summitPoint.elevation),
    );
    expect(url.searchParams.get("past_days")).toBe("3");
    expect(url.searchParams.get("timezone")).toBe("GMT");
  });

  it("accepts both a single object and an array of locations", () => {
    expect(openMeteoResponseSchema.parse(rawLocation())).toHaveLength(1);
    expect(
      openMeteoResponseSchema.parse([rawLocation(), rawLocation()]),
    ).toHaveLength(2);
  });

  it("rejects a response with the wrong number of locations", () => {
    const schema = forecastSchemaFor(resorts, NOW);
    expect(schema.safeParse([rawLocation()]).success).toBe(false);
    expect(schema.safeParse(resorts.map(() => rawLocation())).success).toBe(
      true,
    );
  });
});

describe("mockForecast", () => {
  it("is deterministic per resort and day, always labelled mock, and has 7 days", () => {
    const a = mockForecast(resorts[0], NOW);
    expect(mockForecast(resorts[0], NOW)).toEqual(a);
    expect(a.dataStatus).toBe("mock");
    expect(a.days).toHaveLength(7);
    expect(a.days[0].date).toBe("2026-10-21");
    expect(mockForecast(resorts[1], NOW)).not.toEqual({
      ...a,
      resortSlug: resorts[1].slug,
    });
  });
});

describe("fetchWithFallback", () => {
  const schema = z.object({ ok: z.literal(true) });
  const run = () =>
    fetchWithFallback({
      url: "https://example.test/x",
      schema,
      fallback: () => ({ ok: true as const, from: "mock" }),
    });

  it("returns live data when the response is valid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );
    expect(await run()).toEqual({ data: { ok: true }, status: "live" });
  });

  it("passes the revalidate option to fetch", async () => {
    const spy = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", spy);
    await fetchWithFallback({
      url: "https://example.test/x",
      schema,
      fallback: () => ({ ok: true }),
      revalidate: 120,
    });
    expect(spy).toHaveBeenCalledWith(
      "https://example.test/x",
      expect.objectContaining({ next: { revalidate: 120 } }),
    );
  });

  it.each([
    ["network error", () => Promise.reject(new TypeError("fetch failed"))],
    [
      "HTTP error",
      () => Promise.resolve(new Response("nope", { status: 503 })),
    ],
    ["unexpected shape", () => Promise.resolve(Response.json({ ok: false }))],
    [
      "invalid JSON",
      () => Promise.resolve(new Response("<html>", { status: 200 })),
    ],
  ])("falls back to sample data on %s", async (_name, impl) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(impl));
    const res = await run();
    expect(res.status).toBe("mock");
    expect(res.data).toEqual({ ok: true, from: "mock" });
  });

  it("skips the network entirely when FORCE_MOCK_DATA=1", async () => {
    vi.stubEnv("FORCE_MOCK_DATA", "1");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect((await run()).status).toBe("mock");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("getForecasts", () => {
  it("returns sample data for every resort when the API is unreachable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    const { bySlug, status } = await getForecasts(NOW);
    expect(status).toBe("mock");
    expect(Object.keys(bySlug)).toHaveLength(resorts.length);
    expect(Object.values(bySlug).every((f) => f.dataStatus === "mock")).toBe(
      true,
    );
  });

  it("maps a valid live response to live forecasts", async () => {
    const body = resorts.map(() => rawLocation({ hourlySnow: () => 0.5 }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body)),
    );
    const { bySlug, status } = await getForecasts(NOW);
    expect(status).toBe("live");
    expect(bySlug[resorts[0].slug].next48hSnowfallCm).toBe(24);
    expect(bySlug[resorts[0].slug].powderAlarm).toBe(true);
    expect(bySlug[resorts[0].slug].dataStatus).toBe("live");
  });
});
