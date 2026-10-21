import type { AvalancheBulletin, DangerLevel } from "@/lib/schemas/avalanche";
import type { Resort } from "@/lib/schemas/resort";
import { isCurrent, type RegionStatus } from "./freshness";
import { providerFor, type ProviderId } from "./providers";

export interface ResortRegion {
  regionId: string;
  name: string;
  provider: ProviderId;
  /** "missing": the feed covers this region but has no bulletin for it (or could not be reached). */
  state: "current" | "stale" | "missing";
  bulletin?: AvalancheBulletin;
}

/**
 * What we can say about a resort's avalanche situation:
 * - no_service: no EAWS region at all (e.g. Bulgaria, Georgia): nothing official to show or link
 * - not_covered: an EAWS region exists, but none of our feeds covers it: link out only
 * - covered: at least one region is published by a feed we read; each region has its own state
 */
export type ResortAvalanche =
  | { kind: "no_service" }
  | { kind: "not_covered" }
  | { kind: "covered"; regions: ResortRegion[]; feedsDown: ProviderId[] };

export function resortAvalanche(
  resort: Pick<Resort, "avalancheRegionIds">,
  index: Map<string, RegionStatus>,
  feeds: Record<ProviderId, { state: "live" | "unavailable" }>,
  nameOf: (regionId: string) => string,
): ResortAvalanche {
  if (resort.avalancheRegionIds.length === 0) return { kind: "no_service" };

  const regions: ResortRegion[] = resort.avalancheRegionIds.flatMap(
    (regionId) => {
      const provider = providerFor(regionId);
      if (!provider) return [];
      const status = index.get(regionId);
      return [
        {
          regionId,
          name: nameOf(regionId),
          provider,
          state: status ? status.state : ("missing" as const),
          bulletin: status?.bulletin,
        },
      ];
    },
  );
  if (regions.length === 0) return { kind: "not_covered" };

  const feedsDown = [...new Set(regions.map((r) => r.provider))].filter(
    (p) => feeds[p].state === "unavailable",
  );
  return { kind: "covered", regions, feedsDown };
}

export interface ResortLevel {
  /** The state to display after (re-)checking freshness at `now`. */
  state: "current" | "stale" | "missing";
  /** Highest level among the regions whose bulletin is current; null otherwise. */
  maxLevel: DangerLevel | null;
  current: ResortRegion[];
}

/**
 * Display state for a resort. A region only counts as current if its bulletin passes the freshness
 * rule at `now`, so this is safe to call again in the browser with the visitor's clock.
 */
export function summariseResort(
  regions: ResortRegion[],
  now: Date,
): ResortLevel {
  const current = regions.filter(
    (r) => r.state === "current" && r.bulletin && isCurrent(r.bulletin, now),
  );
  if (current.length > 0) {
    const levels = current.flatMap((r) =>
      r.bulletin?.maxDangerLevel ? [r.bulletin.maxDangerLevel] : [],
    );
    return {
      state: "current",
      maxLevel: levels.length ? (Math.max(...levels) as DangerLevel) : null,
      current,
    };
  }
  const hasBulletin = regions.some((r) => r.bulletin);
  return {
    state: hasBulletin ? "stale" : "missing",
    maxLevel: null,
    current: [],
  };
}
