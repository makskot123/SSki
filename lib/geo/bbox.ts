/** [west, south, east, north] in degrees. */
export type BBox = [number, number, number, number];

type Positions = readonly (readonly number[])[];

interface PolygonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: readonly Positions[] | readonly (readonly Positions[])[];
}

/** Bounding box of a Polygon or MultiPolygon (outer and inner rings alike). Returns null for empty geometry. */
export function bboxOf(geometry: PolygonGeometry, decimals = 3): BBox | null {
  const polygons = (
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  ) as readonly (readonly Positions[])[];
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        if (lon < w) w = lon;
        if (lon > e) e = lon;
        if (lat < s) s = lat;
        if (lat > n) n = lat;
      }
    }
  }
  if (!Number.isFinite(w)) return null;
  const r = (v: number) => Number(v.toFixed(decimals));
  return [r(w), r(s), r(e), r(n)];
}
