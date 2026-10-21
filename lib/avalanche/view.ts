import type {
  AvalancheBulletin,
  DangerLevel,
  ElevationBand,
  ElevationBound,
} from "@/lib/schemas/avalanche";
import type { RegionStatus } from "./freshness";

export interface RegionEntry {
  state: "current" | "stale";
  bulletinId: string;
}

/**
 * JSON-safe snapshot sent to the browser. Each bulletin appears once (one bulletin covers dozens
 * of regions) and regions point to it by id, instead of repeating it per region.
 */
export interface AvalancheView {
  bulletins: AvalancheBulletin[];
  regions: Record<string, RegionEntry>;
}

export function toView(index: Map<string, RegionStatus>): AvalancheView {
  const bulletins = new Map<string, AvalancheBulletin>();
  const regions: Record<string, RegionEntry> = {};
  for (const [regionId, status] of index) {
    bulletins.set(status.bulletin.bulletinId, status.bulletin);
    regions[regionId] = {
      state: status.state,
      bulletinId: status.bulletin.bulletinId,
    };
  }
  return { bulletins: [...bulletins.values()], regions };
}

export function bulletinFor(
  view: AvalancheView,
  regionId: string,
): AvalancheBulletin | undefined {
  const entry = view.regions[regionId];
  return entry && view.bulletins.find((b) => b.bulletinId === entry.bulletinId);
}

/**
 * Region -> highest danger level, for CURRENT bulletins only. A stale bulletin, or one without a
 * numeric rating, never appears here, so it can never be coloured on the map.
 */
export function currentLevels(
  view: AvalancheView,
): Record<string, DangerLevel> {
  const byId = new Map(view.bulletins.map((b) => [b.bulletinId, b]));
  const levels: Record<string, DangerLevel> = {};
  for (const [regionId, entry] of Object.entries(view.regions)) {
    if (entry.state !== "current") continue;
    const level = byId.get(entry.bulletinId)?.maxDangerLevel;
    if (level) levels[regionId] = level;
  }
  return levels;
}

export type ElevationDescription =
  | { kind: "all" }
  | { kind: "above"; bound: ElevationBound }
  | { kind: "below"; bound: ElevationBound }
  | { kind: "between"; lower: ElevationBound; upper: ElevationBound };

export function describeElevation(
  band: ElevationBand | undefined,
): ElevationDescription {
  const lower = band?.lowerBound;
  const upper = band?.upperBound;
  if (lower !== undefined && upper !== undefined)
    return { kind: "between", lower, upper };
  if (lower !== undefined) return { kind: "above", bound: lower };
  if (upper !== undefined) return { kind: "below", bound: upper };
  return { kind: "all" };
}
