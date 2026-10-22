import { describe, expect, it } from "vitest";
import {
  addFix,
  initialTracker,
  MAX_PLAUSIBLE_KMH,
  summarise,
  type Fix,
  type TrackerState,
} from "@/lib/tracker";
import { addSkiDay, parseSkiDays, removeSkiDay } from "@/lib/tracker/storage";

// Metres per degree of latitude (close enough for test tracks).
const M_PER_DEG = 111_195;

/** A straight run north: one fix per second at `kmh`, descending `dropPerS` metres per second. */
function run(
  seconds: number,
  kmh: number,
  {
    start = { lat: 47, lon: 11, t: 0, alt: 2500 },
    dropPerS = 0,
    accuracy = 5,
    deviceSpeed = false,
  } = {},
): Fix[] {
  const step = kmh / 3.6 / M_PER_DEG;
  return Array.from({ length: seconds + 1 }, (_, i) => ({
    t: start.t + i * 1000,
    lat: start.lat + i * step,
    lon: start.lon,
    accuracy,
    altitude: start.alt - i * dropPerS,
    altitudeAccuracy: 5,
    speed: deviceSpeed ? kmh / 3.6 : null,
  }));
}

const feed = (fixes: Fix[], state: TrackerState = initialTracker()) =>
  fixes.reduce(addFix, state);

describe("tracker", () => {
  it("measures distance, moving time and top speed of a steady run", () => {
    const s = feed(run(60, 36)); // 10 m/s for 60 s
    expect(s.distanceM).toBeCloseTo(600, -1);
    expect(s.movingMs).toBe(60_000);
    expect(s.maxSpeedKmh).toBeCloseTo(36, 0);
  });

  it("prefers the device's own speed when it reports one", () => {
    const fixes = run(10, 50, { deviceSpeed: true });
    expect(feed(fixes).currentSpeedKmh).toBeCloseTo(50, 5);
  });

  it("ignores inaccurate fixes", () => {
    const s = feed(run(20, 30, { accuracy: 80 }));
    expect(s.distanceM).toBe(0);
    expect(s.ignored).toBe(21);
  });

  it("drops an impossible GPS jump instead of turning it into a record speed", () => {
    const fixes = run(10, 30);
    const jump = { ...fixes[5], lat: fixes[5].lat + 0.01 }; // 1.1 km in one second
    const s = feed([...fixes.slice(0, 5), jump, ...fixes.slice(5)]);
    expect(s.ignored).toBe(1);
    expect(s.maxSpeedKmh).toBeLessThan(MAX_PLAUSIBLE_KMH);
    expect(s.maxSpeedKmh).toBeCloseTo(30, 0);
  });

  it("a single speed spike does not become the top speed (median of three)", () => {
    const fixes = run(20, 20, { deviceSpeed: true });
    fixes[10] = { ...fixes[10], speed: 120 / 3.6 };
    expect(feed(fixes).maxSpeedKmh).toBeCloseTo(20, 0);
  });

  it("standing still with GPS drift adds no distance or moving time", () => {
    const still: Fix[] = Array.from({ length: 60 }, (_, i) => ({
      t: i * 1000,
      lat: 47 + (i % 2 ? 0.000005 : -0.000005), // about ±0.5 m wobble
      lon: 11,
      accuracy: 8,
    }));
    const s = feed(still);
    expect(s.distanceM).toBe(0);
    expect(s.movingMs).toBe(0);
  });

  it("counts descent but not altitude noise", () => {
    expect(feed(run(100, 30, { dropPerS: 3 })).descentM).toBeCloseTo(300, -1);
    const noisy = run(100, 0).map((f, i) => ({
      ...f,
      altitude: 2500 + (i % 2 ? 4 : -4),
    }));
    expect(feed(noisy).descentM).toBe(0);
  });

  it("a long gap (tunnel, locked phone) adds no moving time", () => {
    const a = run(10, 30);
    const last = a[a.length - 1];
    const b = run(10, 30, {
      start: { lat: last.lat + 0.001, lon: 11, t: last.t + 300_000, alt: 2500 },
    });
    const s = feed([...a, ...b]);
    expect(s.movingMs).toBe(20_000);
  });

  it("summarises a day with rounded values", () => {
    const s = feed(run(60, 36, { dropPerS: 2 }));
    const day = summarise(
      s,
      new Date("2026-01-10T09:00:00Z"),
      new Date("2026-01-10T15:00:00Z"),
    );
    expect(day).toMatchObject({
      startedAt: "2026-01-10T09:00:00.000Z",
      endedAt: "2026-01-10T15:00:00.000Z",
      movingMs: 60000,
    });
    expect(Number.isInteger(day.distanceM)).toBe(true);
  });
});

describe("saved ski days", () => {
  const day = (id: string, startedAt: string) => ({
    id,
    startedAt,
    endedAt: startedAt,
    distanceM: 1000,
    descentM: 500,
    maxSpeedKmh: 50,
    movingMs: 3_600_000,
  });

  it("parses defensively and keeps newest first", () => {
    const raw = JSON.stringify([
      day("a", "2026-01-01T09:00:00.000Z"),
      { id: "broken" },
      day("b", "2026-02-01T09:00:00.000Z"),
    ]);
    expect(parseSkiDays(raw).map((d) => d.id)).toEqual(["b", "a"]);
    expect(parseSkiDays("{oops")).toEqual([]);
    expect(parseSkiDays('{"a":1}')).toEqual([]);
  });

  it("adds and removes days", () => {
    let days = addSkiDay([], day("a", "2026-01-01T09:00:00.000Z"));
    days = addSkiDay(days, day("b", "2026-01-02T09:00:00.000Z"));
    expect(days.map((d) => d.id)).toEqual(["b", "a"]);
    expect(removeSkiDay(days, "b").map((d) => d.id)).toEqual(["a"]);
  });
});
