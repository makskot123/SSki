import { aspectSchema, type Aspect } from "@/lib/schemas/resort";

/** Clockwise from north. */
export const ASPECT_ORDER: readonly Aspect[] = aspectSchema.options;

/** The aspect directly opposite, e.g. N <-> S. */
export function oppositeAspect(aspect: Aspect): Aspect {
  const i = ASPECT_ORDER.indexOf(aspect);
  return ASPECT_ORDER[(i + 4) % ASPECT_ORDER.length];
}

/**
 * Slopes on the sheltered (lee) side of a wind blowing FROM `windFrom`: the three aspects centred on
 * the opposite direction. Wind from W deposits snow mainly on NE, E and SE slopes.
 * Slopes across the wind can be cross-loaded as well; this is the most likely loading, not the only one.
 */
export function leeAspects(windFrom: Aspect): Aspect[] {
  const n = ASPECT_ORDER.length;
  const centre = ASPECT_ORDER.indexOf(oppositeAspect(windFrom));
  return [-1, 0, 1].map((d) => ASPECT_ORDER[(centre + d + n) % n]);
}

export type SteepnessBand =
  "flat" | "borderline" | "terrain" | "peak" | "steep" | "verysteep";

/** Lower bound (inclusive) of each band, in degrees. Rules of thumb, documented on the aspects page. */
export const STEEPNESS_BANDS: { id: SteepnessBand; from: number }[] = [
  { id: "flat", from: 0 },
  { id: "borderline", from: 25 },
  { id: "terrain", from: 30 },
  { id: "peak", from: 35 },
  { id: "steep", from: 40 },
  { id: "verysteep", from: 46 },
];

/** Whole degrees are used throughout: 45 is still "steep", 46 is "very steep". */
export function steepnessBand(degrees: number): SteepnessBand {
  const deg = Math.max(0, Math.round(degrees));
  let band: SteepnessBand = "flat";
  for (const b of STEEPNESS_BANDS) if (deg >= b.from) band = b.id;
  return band;
}

/** The classic slab-avalanche range: about 30-45 degrees. */
export function isCriticalRange(degrees: number): boolean {
  const deg = Math.round(degrees);
  return deg >= 30 && deg <= 45;
}

/** Slope as a percent grade (rise over run), as shown on many ski maps. 45 degrees = 100%. */
export function slopePercent(degrees: number): number {
  return Math.round(Math.tan((degrees * Math.PI) / 180) * 100);
}
