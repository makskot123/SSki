import { describe, expect, it } from "vitest";
import {
  coverage,
  MAX_TRIP_DAYS,
  orderPlan,
  parsePlannerQuery,
  planScores,
  tripDates,
} from "@/lib/planner";

const TODAY = "2026-10-22";
const COUNTRIES = ["AT", "CH", "FR"];

describe("parsePlannerQuery", () => {
  it("defaults to today and the next two days, all countries", () => {
    expect(parsePlannerQuery({}, TODAY, COUNTRIES)).toEqual({
      from: "2026-10-22",
      to: "2026-10-24",
      country: null,
      adjusted: false,
    });
  });

  it("keeps a valid request", () => {
    expect(
      parsePlannerQuery(
        { from: "2026-12-20", to: "2026-12-27", country: "at" },
        TODAY,
        COUNTRIES,
      ),
    ).toEqual({
      from: "2026-12-20",
      to: "2026-12-27",
      country: "AT",
      adjusted: false,
    });
  });

  it("corrects past dates, reversed dates, long trips and unknown countries, and says so", () => {
    expect(
      parsePlannerQuery({ from: "2026-01-01" }, TODAY, COUNTRIES),
    ).toMatchObject({
      from: TODAY,
      adjusted: true,
    });
    expect(
      parsePlannerQuery(
        { from: "2026-12-20", to: "2026-12-10" },
        TODAY,
        COUNTRIES,
      ),
    ).toMatchObject({ to: "2026-12-20", adjusted: true });
    const long = parsePlannerQuery(
      { from: "2026-12-01", to: "2027-01-31" },
      TODAY,
      COUNTRIES,
    );
    expect(tripDates(long.from, long.to)).toHaveLength(MAX_TRIP_DAYS);
    expect(long.adjusted).toBe(true);
    expect(
      parsePlannerQuery({ country: "XX" }, TODAY, COUNTRIES),
    ).toMatchObject({
      country: null,
      adjusted: true,
    });
    expect(
      parsePlannerQuery({ from: "garbage" }, TODAY, COUNTRIES).adjusted,
    ).toBe(true);
  });

  it("accepts 'all' without a correction note", () => {
    expect(
      parsePlannerQuery({ country: "all" }, TODAY, COUNTRIES).adjusted,
    ).toBe(false);
  });
});

describe("coverage", () => {
  const forecast = tripDates("2026-10-22", "2026-10-28");

  it("is full, partial or none", () => {
    expect(coverage(tripDates("2026-10-23", "2026-10-25"), forecast).kind).toBe(
      "full",
    );
    expect(coverage(tripDates("2026-10-27", "2026-10-30"), forecast)).toEqual({
      kind: "partial",
      covered: 2,
      total: 4,
    });
    expect(coverage(tripDates("2026-12-20", "2026-12-27"), forecast).kind).toBe(
      "none",
    );
  });
});

describe("planScores and orderPlan", () => {
  it("blends forecast snow into the resort score", () => {
    const rows = planScores([
      { slug: "a", baseScore: 80, tripSnowCm: 0 },
      { slug: "b", baseScore: 60, tripSnowCm: 40 },
    ]);
    expect(rows[0].planScore).toBeCloseTo(48);
    expect(rows[1].planScore).toBeCloseTo(76);
  });

  it("uses the resort score alone when no snow data is usable (beyond the horizon or sample data)", () => {
    const rows = planScores([
      { slug: "a", baseScore: 80, tripSnowCm: null },
      { slug: "b", baseScore: 60, tripSnowCm: null },
    ]);
    expect(rows.map((r) => r.planScore)).toEqual([80, 60]);
  });

  it("lists resorts with a current level 4 or 5 last, whatever their score", () => {
    const rows = planScores([
      { slug: "high", baseScore: 95, tripSnowCm: null },
      { slug: "ok", baseScore: 50, tripSnowCm: null },
      { slug: "unknown", baseScore: 70, tripSnowCm: null },
    ]).map((r) => ({ ...r, name: r.slug }));
    const levels: Record<string, 1 | 2 | 3 | 4 | 5 | null> = {
      high: 4,
      ok: 2,
      unknown: null,
    };
    expect(orderPlan(rows, (r) => levels[r.slug]).map((r) => r.slug)).toEqual([
      "unknown",
      "ok",
      "high",
    ]);
  });
});
