import {
  pointInMultiPolygon,
  pointInPolygon,
  type Polygon,
} from "./point-in-polygon.ts";

export interface RegionFeature {
  properties: {
    id: string;
    start_date?: string | null;
    end_date?: string | null;
  };
  geometry:
    | { type: "Polygon"; coordinates: Polygon }
    | { type: "MultiPolygon"; coordinates: Polygon[] };
}

/** EAWS keeps old polygons with start/end dates; only those valid on `day` (YYYY-MM-DD) apply. */
export function isValidOn(f: RegionFeature, day: string): boolean {
  const { start_date: start, end_date: end } = f.properties;
  return (!start || start <= day) && (!end || end >= day);
}

function contains(
  f: RegionFeature,
  point: { lat: number; lon: number },
): boolean {
  return f.geometry.type === "Polygon"
    ? pointInPolygon(point, f.geometry.coordinates)
    : pointInMultiPolygon(point, f.geometry.coordinates);
}

/** Sorted, de-duplicated ids of all valid regions that contain at least one of the points. */
export function regionIdsForPoints(
  points: { lat: number; lon: number }[],
  features: RegionFeature[],
  day: string,
): string[] {
  const ids = new Set<string>();
  for (const f of features) {
    if (!isValidOn(f, day)) continue;
    if (points.some((p) => contains(f, p))) ids.add(f.properties.id);
  }
  return [...ids].sort();
}
