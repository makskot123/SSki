import { distanceKm } from "@/lib/geo/distance";

/*
 * Ski-day tracker logic (PLAN.md section 9.4, B1). Pure functions over GPS fixes, so the noisy parts
 * (inaccurate fixes, jumps, altitude jitter) are unit-tested with recorded tracks. Nothing here is sent
 * anywhere: the browser feeds fixes in, the totals stay on the device.
 */

export interface Fix {
  /** Milliseconds since epoch. */
  t: number;
  lat: number;
  lon: number;
  /** Horizontal accuracy in metres (95% radius, as the browser reports it). */
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  /** Speed in m/s if the device measured it (Doppler), else null. */
  speed?: number | null;
}

/** Fixes less accurate than this are ignored. */
export const MAX_ACCURACY_M = 35;
/** Faster than this is a GPS jump, not skiing (the speed-skiing record is about 255 km/h). */
export const MAX_PLAUSIBLE_KMH = 160;
/** Below this the skier counts as standing (GPS drifts a little even when still). */
export const MOVING_KMH = 4;
/** Longer gaps between fixes (tunnel, phone locked) add distance but no moving time. */
export const MAX_GAP_S = 60;
/** Altitude has to change by this much before it counts as descent, to ignore GPS altitude noise. */
export const ALTITUDE_STEP_M = 8;
/** Altitude is only used when the device says it is at least this accurate. */
export const MAX_ALTITUDE_ACCURACY_M = 20;

export interface TrackerState {
  last: Fix | null;
  distanceM: number;
  descentM: number;
  movingMs: number;
  maxSpeedKmh: number;
  currentSpeedKmh: number;
  /** Last few speeds, to take the median (a single spike never becomes the top speed). */
  recentKmh: number[];
  /** Reference altitude for the descent hysteresis. */
  refAltitude: number | null;
  /** Fixes used / ignored, shown as a GPS quality hint. */
  used: number;
  ignored: number;
}

export const initialTracker = (): TrackerState => ({
  last: null,
  distanceM: 0,
  descentM: 0,
  movingMs: 0,
  maxSpeedKmh: 0,
  currentSpeedKmh: 0,
  recentKmh: [],
  refAltitude: null,
  used: 0,
  ignored: 0,
});

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function usableAltitude(f: Fix): number | null {
  if (f.altitude === null || f.altitude === undefined) return null;
  if (
    f.altitudeAccuracy !== null &&
    f.altitudeAccuracy !== undefined &&
    f.altitudeAccuracy > MAX_ALTITUDE_ACCURACY_M
  ) {
    return null;
  }
  return f.altitude;
}

/** Adds one GPS fix. Returns a new state; inaccurate or impossible fixes only bump `ignored`. */
export function addFix(state: TrackerState, fix: Fix): TrackerState {
  const ignore = () => ({ ...state, ignored: state.ignored + 1 });
  if (!(fix.accuracy <= MAX_ACCURACY_M)) return ignore();

  // Altitude: hysteresis, so jitter of a few metres never adds up to fake descent.
  let { refAltitude, descentM } = state;
  const alt = usableAltitude(fix);
  if (alt !== null) {
    if (refAltitude === null || alt > refAltitude + ALTITUDE_STEP_M) {
      refAltitude = alt;
    } else if (alt < refAltitude - ALTITUDE_STEP_M) {
      descentM += refAltitude - alt;
      refAltitude = alt;
    }
  }

  const last = state.last;
  if (!last) {
    return { ...state, last: fix, refAltitude, used: state.used + 1 };
  }
  const dtS = (fix.t - last.t) / 1000;
  if (dtS <= 0) return ignore();

  const dM = distanceKm(last, fix) * 1000;
  const segmentKmh = (dM / dtS) * 3.6;
  if (segmentKmh > MAX_PLAUSIBLE_KMH) return ignore();

  const deviceKmh =
    fix.speed !== null && fix.speed !== undefined && fix.speed >= 0
      ? fix.speed * 3.6
      : null;
  const speedKmh = Math.min(deviceKmh ?? segmentKmh, MAX_PLAUSIBLE_KMH);
  // Without a measured device speed, a step shorter than half the fix accuracy is GPS wobble.
  const beyondNoise =
    deviceKmh !== null || dM >= Math.min(fix.accuracy, 10) / 2;
  const moving = speedKmh >= MOVING_KMH && beyondNoise;
  const recentKmh = [...state.recentKmh, speedKmh].slice(-3);
  const smoothed = recentKmh.length === 3 ? median(recentKmh) : 0;

  return {
    last: fix,
    // Standing still, GPS drift is not distance.
    distanceM: state.distanceM + (moving ? dM : 0),
    descentM,
    movingMs: state.movingMs + (moving && dtS <= MAX_GAP_S ? dtS * 1000 : 0),
    maxSpeedKmh: Math.max(state.maxSpeedKmh, smoothed),
    currentSpeedKmh: speedKmh,
    recentKmh,
    refAltitude,
    used: state.used + 1,
    ignored: state.ignored,
  };
}

/** A finished ski day, as saved on the device. */
export interface SkiDay {
  id: string;
  startedAt: string;
  endedAt: string;
  distanceM: number;
  descentM: number;
  maxSpeedKmh: number;
  movingMs: number;
}

export function summarise(
  state: TrackerState,
  startedAt: Date,
  endedAt: Date,
): SkiDay {
  return {
    id: `${startedAt.getTime().toString(36)}`,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    distanceM: Math.round(state.distanceM),
    descentM: Math.round(state.descentM),
    maxSpeedKmh: Math.round(state.maxSpeedKmh * 10) / 10,
    movingMs: Math.round(state.movingMs),
  };
}
