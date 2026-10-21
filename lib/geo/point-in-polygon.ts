/** GeoJSON coordinates are [longitude, latitude]. */
export type Position = readonly [number, number, ...number[]];
export type Ring = readonly Position[];
/** First ring is the outer boundary, the rest are holes. */
export type Polygon = readonly Ring[];

function inRing([x, y]: readonly [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygon(
  point: { lon: number; lat: number },
  polygon: Polygon,
): boolean {
  const p: [number, number] = [point.lon, point.lat];
  const [outer, ...holes] = polygon;
  if (!outer || !inRing(p, outer)) return false;
  return !holes.some((hole) => inRing(p, hole));
}

export function pointInMultiPolygon(
  point: { lon: number; lat: number },
  polygons: readonly Polygon[],
): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}
