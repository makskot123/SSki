import {
  caamlBulletinSchema,
  caamlEnvelopeSchema,
  type AvalancheBulletin,
  type CaamlBulletin,
  type DangerLevel,
  type DangerRating,
  type ElevationBand,
} from "@/lib/schemas/avalanche";
import type { FeedProvider } from "./providers";

const LEVELS: Record<string, DangerLevel> = {
  low: 1,
  moderate: 2,
  considerable: 3,
  high: 4,
  very_high: 5,
};

function toBand(
  e: { lowerBound?: string; upperBound?: string } | undefined,
): ElevationBand | undefined {
  if (!e || (e.lowerBound === undefined && e.upperBound === undefined))
    return undefined;
  const conv = (v: string) =>
    v === "treeline" ? ("treeline" as const) : Number(v);
  return {
    ...(e.lowerBound !== undefined && { lowerBound: conv(e.lowerBound) }),
    ...(e.upperBound !== undefined && { upperBound: conv(e.upperBound) }),
  };
}

/** Free text is rendered as plain text, but strip markup anyway so it can never be mistaken for HTML. */
export function toPlainText(input: string | undefined): string | undefined {
  const text = input
    ?.replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text : undefined;
}

export function normaliseBulletin(
  b: CaamlBulletin,
  provider: FeedProvider,
): AvalancheBulletin {
  const dangerRatings: DangerRating[] = b.dangerRatings.map((r) => ({
    level: LEVELS[r.mainValue] ?? null,
    elevation: toBand(r.elevation),
    validTimePeriod: r.validTimePeriod ?? "all_day",
  }));
  const levels = dangerRatings.flatMap((r) =>
    r.level === null ? [] : [r.level],
  );

  return {
    bulletinId: b.bulletinID,
    regionIds: b.regions.map((r) => r.regionID),
    regionNames: Object.fromEntries(
      b.regions.flatMap((r) => (r.name ? [[r.regionID, r.name]] : [])),
    ),
    publicationTime: b.publicationTime,
    validFrom: b.validTime.startTime,
    validUntil: b.validTime.endTime,
    dangerRatings,
    maxDangerLevel: levels.length ? (Math.max(...levels) as DangerLevel) : null,
    problems: (b.avalancheProblems ?? []).map((p) => ({
      type: p.problemType,
      aspects: p.aspects ?? [],
      elevation: toBand(p.elevation),
      validTimePeriod: p.validTimePeriod ?? "all_day",
    })),
    highlights: toPlainText(b.avalancheActivity?.highlights),
    sourceUrl: provider.sourceUrl,
    provider: {
      id: provider.id,
      name: provider.name,
      url: provider.url,
      license: provider.license,
    },
    lang: b.lang ?? "en",
  };
}

/**
 * Parses a whole CAAML feed. An invalid envelope throws (the caller treats it as an outage).
 * An individual bulletin that fails validation is dropped, which makes its regions show
 * "no current data": the safe failure mode, never a guessed level.
 */
export function parseCaamlFeed(
  json: unknown,
  provider: FeedProvider,
): AvalancheBulletin[] {
  const { bulletins } = caamlEnvelopeSchema.parse(json);
  return bulletins.flatMap((raw) => {
    const parsed = caamlBulletinSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(
        `[avalanche:${provider.id}] dropped a bulletin that failed validation`,
        parsed.error.issues[0],
      );
      return [];
    }
    return [normaliseBulletin(parsed.data, provider)];
  });
}
