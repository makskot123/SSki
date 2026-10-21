import type { AvalancheBulletin } from "@/lib/schemas/avalanche";

/** A bulletin older than this is never shown as a current level, even if its validity window is still open. */
export const MAX_BULLETIN_AGE_HOURS = 24;
/** Tolerated clock difference for a bulletin that claims to be published slightly in the future. */
const FUTURE_SKEW_MS = 15 * 60_000;
const HOUR_MS = 3_600_000;

/**
 * Current = inside its validity window AND published at most 24 h ago.
 * Anything else must be shown as "no current data" instead of a stale level.
 */
export function isCurrent(b: AvalancheBulletin, now: Date): boolean {
  const t = now.getTime();
  const from = Date.parse(b.validFrom);
  const until = Date.parse(b.validUntil);
  const published = Date.parse(b.publicationTime);
  if ([from, until, published].some(Number.isNaN)) return false;
  if (t < from || t > until) return false;
  if (published > t + FUTURE_SKEW_MS) return false;
  return t - published <= MAX_BULLETIN_AGE_HOURS * HOUR_MS;
}

export type RegionStatus =
  | { state: "current"; bulletin: AvalancheBulletin }
  /** A bulletin exists but is out of date: show "no current data" (and optionally when it was published). */
  | { state: "stale"; bulletin: AvalancheBulletin };

/**
 * Per region, the best bulletin: the newest current one, otherwise the newest stale one.
 * Regions with no bulletin at all are simply absent from the map.
 */
export function buildRegionIndex(
  bulletins: AvalancheBulletin[],
  now: Date,
): Map<string, RegionStatus> {
  const index = new Map<string, RegionStatus>();
  const newer = (a: AvalancheBulletin, b: AvalancheBulletin) =>
    Date.parse(a.publicationTime) > Date.parse(b.publicationTime);

  for (const bulletin of bulletins) {
    const state = isCurrent(bulletin, now) ? "current" : "stale";
    for (const regionId of bulletin.regionIds) {
      const existing = index.get(regionId);
      const replace =
        !existing ||
        (state === "current" && existing.state === "stale") ||
        (state === existing.state && newer(bulletin, existing.bulletin));
      if (replace) index.set(regionId, { state, bulletin });
    }
  }
  return index;
}

/** Union of the statuses of a resort's regions, most dangerous current bulletin first. */
export function resortStatuses(
  regionIds: string[],
  index: Map<string, RegionStatus>,
): RegionStatus[] {
  return regionIds
    .flatMap((id) => {
      const s = index.get(id);
      return s ? [s] : [];
    })
    .sort(
      (a, b) =>
        Number(b.state === "current") - Number(a.state === "current") ||
        (b.bulletin.maxDangerLevel ?? 0) - (a.bulletin.maxDangerLevel ?? 0),
    );
}
