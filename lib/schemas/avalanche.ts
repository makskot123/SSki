import { z } from "zod";
import { aspectSchema } from "@/lib/schemas/resort";

/* ---------- Normalised model used by the app ---------- */

export type DangerLevel = 1 | 2 | 3 | 4 | 5;

export const PROBLEM_TYPES = [
  "new_snow",
  "wind_slab",
  "persistent_weak_layers",
  "wet_snow",
  "gliding_snow",
  "cornices",
  "no_distinct_avalanche_problem",
  "favourable_situation",
] as const;
export type AvalancheProblemType = (typeof PROBLEM_TYPES)[number];

export type TimePeriod = "all_day" | "earlier" | "later";
export type ElevationBound = number | "treeline";

export interface ElevationBand {
  lowerBound?: ElevationBound;
  upperBound?: ElevationBound;
}

export interface DangerRating {
  /** null when the service reports "no snow" or "no rating": never shown as a danger level. */
  level: DangerLevel | null;
  elevation?: ElevationBand;
  validTimePeriod: TimePeriod;
}

export interface AvalancheProblem {
  type: AvalancheProblemType;
  aspects: z.infer<typeof aspectSchema>[];
  elevation?: ElevationBand;
  validTimePeriod: TimePeriod;
}

export interface ProviderInfo {
  id: string;
  name: string;
  url: string;
  license: string;
}

export interface AvalancheBulletin {
  bulletinId: string;
  regionIds: string[];
  /** All times are ISO 8601 with an explicit offset (as published). */
  publicationTime: string;
  validFrom: string;
  validUntil: string;
  dangerRatings: DangerRating[];
  /** Highest rating across elevations and time periods; null if there is no numeric rating. */
  maxDangerLevel: DangerLevel | null;
  problems: AvalancheProblem[];
  /** Plain text only. */
  highlights?: string;
  /** Where the full official bulletin can be read. */
  sourceUrl: string;
  provider: ProviderInfo;
  lang: string;
}

/* ---------- CAAML v6 (EAWS bulletin) input, only the parts we use ---------- */

// Timestamps must carry an offset: a naive time cannot be checked for freshness reliably.
const timestamp = z.iso.datetime({ offset: true });

const bound = z.union([z.literal("treeline"), z.string().regex(/^\d{1,4}$/)]);
const elevationSchema = z.object({
  lowerBound: bound.optional(),
  upperBound: bound.optional(),
});
const timePeriod = z.enum(["all_day", "earlier", "later"]);

export const RATING_VALUES = [
  "low",
  "moderate",
  "considerable",
  "high",
  "very_high",
  "no_snow",
  "no_rating",
] as const;

export const caamlBulletinSchema = z.object({
  bulletinID: z.string().min(1),
  publicationTime: timestamp,
  validTime: z.object({ startTime: timestamp, endTime: timestamp }),
  lang: z.string().optional(),
  regions: z.array(z.object({ regionID: z.string().min(1) })).min(1),
  dangerRatings: z
    .array(
      z.object({
        mainValue: z.enum(RATING_VALUES),
        elevation: elevationSchema.optional(),
        validTimePeriod: timePeriod.optional(),
      }),
    )
    .min(1),
  avalancheProblems: z
    .array(
      z.object({
        problemType: z.enum(PROBLEM_TYPES),
        aspects: z.array(aspectSchema).optional(),
        elevation: elevationSchema.optional(),
        validTimePeriod: timePeriod.optional(),
      }),
    )
    .optional(),
  avalancheActivity: z.object({ highlights: z.string().optional() }).optional(),
});

export type CaamlBulletin = z.infer<typeof caamlBulletinSchema>;

/** The envelope is validated here; each bulletin is validated on its own so one bad entry cannot hide the rest. */
export const caamlEnvelopeSchema = z.object({
  bulletins: z.array(z.unknown()),
});
