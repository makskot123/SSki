import { z } from "zod";
import { isCurrent, type RegionStatus } from "@/lib/avalanche/freshness";
import { PROVIDERS, type ProviderId } from "@/lib/avalanche/providers";
import { aspectSchema, resortSchema, type Resort } from "@/lib/schemas/resort";
import { PROBLEM_TYPES, type AvalancheBulletin } from "@/lib/schemas/avalanche";
import type { SnowForecast } from "@/lib/weather/types";

/*
 * Public JSON contracts of /api/v1/*. Used by the installable app and its offline cache.
 * Breaking changes need a new version path; additive fields are allowed.
 */
export const API_VERSION = 1;

const isoDateTime = z.iso.datetime({ offset: true });
const level = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/* ---------- /api/v1/resorts ---------- */

export const resortsResponseSchema = z.strictObject({
  version: z.literal(API_VERSION),
  generatedAt: isoDateTime,
  resorts: z.array(resortSchema),
});
export type ResortsResponse = z.infer<typeof resortsResponseSchema>;

export function buildResortsResponse(
  resorts: Resort[],
  now: Date,
): ResortsResponse {
  return { version: API_VERSION, generatedAt: now.toISOString(), resorts };
}

/* ---------- /api/v1/forecasts ---------- */

const forecastDaySchema = z.strictObject({
  date: z.iso.date(),
  snowfallCm: z.number().min(0),
  freezingLevelM: z.number().nullable(),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  windMaxKmh: z.number().min(0),
  windGustKmh: z.number().min(0),
  windDirectionDeg: z.number().min(0).max(360),
});

const forecastSchema = z.strictObject({
  resortSlug: z.string(),
  generatedAt: isoDateTime,
  elevationM: z.number(),
  days: z.array(forecastDaySchema),
  past72hSnowfallCm: z.number().min(0),
  next48hSnowfallCm: z.number().min(0),
  powderAlarm: z.boolean(),
  windWarning: z.boolean(),
  dataStatus: z.enum(["live", "mock"]),
});

export const forecastsResponseSchema = z
  .strictObject({
    version: z.literal(API_VERSION),
    generatedAt: isoDateTime,
    /** "mock" = sample data: shown labelled, never used for alerts or the ranking. */
    status: z.enum(["live", "mock"]),
    attribution: z.string(),
    forecasts: z.array(forecastSchema),
  })
  .superRefine((r, ctx) => {
    // Sample data must never carry an alert, and every entry must agree with the top-level status.
    r.forecasts.forEach((f, i) => {
      if (f.dataStatus !== r.status) {
        ctx.addIssue({
          code: "custom",
          message: "dataStatus differs from status",
          path: ["forecasts", i],
        });
      }
      if (r.status === "mock" && (f.powderAlarm || f.windWarning)) {
        ctx.addIssue({
          code: "custom",
          message: "sample data carries an alert",
          path: ["forecasts", i],
        });
      }
    });
  });
export type ForecastsResponse = z.infer<typeof forecastsResponseSchema>;

export function buildForecastsResponse(
  forecasts: SnowForecast[],
  status: "live" | "mock",
  now: Date,
): ForecastsResponse {
  return {
    version: API_VERSION,
    generatedAt: now.toISOString(),
    status,
    attribution: "Weather data by Open-Meteo.com (CC BY 4.0)",
    // Sample data never raises alerts (same rule as the pages).
    forecasts:
      status === "mock"
        ? forecasts.map((f) => ({
            ...f,
            powderAlarm: false,
            windWarning: false,
          }))
        : forecasts,
  };
}

/* ---------- /api/v1/avalanche ---------- */

const elevationBound = z.union([z.number(), z.literal("treeline")]);
const elevationBand = z.strictObject({
  lowerBound: elevationBound.optional(),
  upperBound: elevationBound.optional(),
});
const period = z.enum(["all_day", "earlier", "later"]);

const bulletinSchema = z.strictObject({
  bulletinId: z.string(),
  regionIds: z.array(z.string()),
  regionNames: z.record(z.string(), z.string()),
  publicationTime: isoDateTime,
  validFrom: isoDateTime,
  validUntil: isoDateTime,
  dangerRatings: z.array(
    z.strictObject({
      level: level.nullable(),
      elevation: elevationBand.optional(),
      validTimePeriod: period,
    }),
  ),
  maxDangerLevel: level.nullable(),
  problems: z.array(
    z.strictObject({
      type: z.enum(PROBLEM_TYPES),
      aspects: z.array(aspectSchema),
      elevation: elevationBand.optional(),
      validTimePeriod: period,
    }),
  ),
  highlights: z.string().optional(),
  sourceUrl: z.url(),
  provider: z.strictObject({
    id: z.string(),
    name: z.string(),
    url: z.url(),
    license: z.string(),
  }),
  lang: z.string(),
});

/** A region's entry. Only "current" carries a level; "stale" deliberately has no level field at all. */
const regionEntrySchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("current"),
    bulletinId: z.string(),
    level: level.nullable(),
    validUntil: isoDateTime,
  }),
  z.strictObject({ state: z.literal("stale"), publishedAt: isoDateTime }),
]);

export const avalancheResponseSchema = z
  .strictObject({
    version: z.literal(API_VERSION),
    generatedAt: isoDateTime,
    /** Clients must re-check `validUntil` against their own clock: responses are cached for minutes. */
    freshnessRule: z.string(),
    feeds: z.record(
      z.string(),
      z.strictObject({
        state: z.enum(["live", "unavailable"]),
        count: z.number().int().min(0),
      }),
    ),
    attribution: z.array(z.string()),
    regions: z.record(z.string(), regionEntrySchema),
    /** Current bulletins only. Stale bulletins are not sent. */
    bulletins: z.array(bulletinSchema),
  })
  .superRefine((r, ctx) => {
    const ids = new Set(r.bulletins.map((b) => b.bulletinId));
    for (const [regionId, entry] of Object.entries(r.regions)) {
      if (entry.state === "current" && !ids.has(entry.bulletinId)) {
        ctx.addIssue({
          code: "custom",
          message: "current region without its bulletin",
          path: ["regions", regionId],
        });
      }
    }
  });
export type AvalancheResponse = z.infer<typeof avalancheResponseSchema>;

export function buildAvalancheResponse(
  data: {
    index: Map<string, RegionStatus>;
    feeds: Record<ProviderId, { state: "live" | "unavailable"; count: number }>;
  },
  now: Date,
): AvalancheResponse {
  const regions: AvalancheResponse["regions"] = {};
  const bulletins = new Map<string, AvalancheBulletin>();
  for (const [regionId, status] of data.index) {
    const b = status.bulletin;
    // Re-check here as well: the index may be older than `now`.
    if (status.state === "current" && isCurrent(b, now)) {
      regions[regionId] = {
        state: "current",
        bulletinId: b.bulletinId,
        level: b.maxDangerLevel,
        validUntil: b.validUntil,
      };
      bulletins.set(b.bulletinId, b);
    } else {
      regions[regionId] = { state: "stale", publishedAt: b.publicationTime };
    }
  }
  return {
    version: API_VERSION,
    generatedAt: now.toISOString(),
    freshnessRule:
      "A level applies only while now is within [validFrom, validUntil] and at most 24 h after publicationTime. Otherwise show 'No current data'.",
    feeds: data.feeds,
    attribution: Object.values(PROVIDERS).map(
      (p) => `${p.name} (${p.license})`,
    ),
    regions,
    bulletins: [...bulletins.values()],
  };
}
