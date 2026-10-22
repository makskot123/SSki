import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  avalancheResponseSchema,
  forecastsResponseSchema,
  resortsResponseSchema,
} from "../../lib/api/contracts";

// The e2e server runs with FORCE_MOCK_DATA=1 (sample weather) and the recorded-bulletin feed stub.
const regionIdsInStub = new Set(
  ["tyrol-2026-02-15.json", "slf-2026-02-15.json"].flatMap((name) =>
    (
      JSON.parse(
        readFileSync(
          path.join(__dirname, "../fixtures/avalanche", name),
          "utf8",
        ),
      ).bulletins as {
        regions: { regionID: string }[];
      }[]
    ).flatMap((b) => b.regions.map((r) => r.regionID)),
  ),
);

test.describe("data API v1", () => {
  test("/api/v1/resorts returns all resorts in the published contract", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/resorts");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/application\/json/);
    expect(res.headers()["cache-control"]).toMatch(/max-age=\d+/);
    const parsed = resortsResponseSchema.safeParse(await res.json());
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.[0])).toBe(
      true,
    );
    expect(parsed.data!.resorts).toHaveLength(30);
  });

  test("/api/v1/forecasts labels sample data and never sends alerts with it", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/forecasts");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const parsed = forecastsResponseSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.[0])).toBe(
      true,
    );
    expect(body.status).toBe("mock");
    expect(body.forecasts).toHaveLength(30);
    expect(
      body.forecasts.every(
        (f: { powderAlarm: boolean; windWarning: boolean }) =>
          !f.powderAlarm && !f.windWarning,
      ),
    ).toBe(true);
    expect(body.attribution).toMatch(/Open-Meteo/);
  });

  test("/api/v1/avalanche: current regions with level, validity and their bulletins", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/avalanche");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toMatch(/max-age=\d+/);
    const body = await res.json();
    const parsed = avalancheResponseSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.[0])).toBe(
      true,
    );

    const entries = Object.entries(parsed.data!.regions);
    expect(entries.length).toBe(regionIdsInStub.size);
    const now = Date.now();
    for (const [id, entry] of entries) {
      expect(regionIdsInStub.has(id), id).toBe(true);
      expect(entry.state, id).toBe("current");
      if (entry.state === "current")
        expect(Date.parse(entry.validUntil), id).toBeGreaterThan(now);
    }
    expect(parsed.data!.feeds).toMatchObject({
      euregio: { state: "live" },
      slf: { state: "live" },
    });
    expect(body.freshnessRule).toMatch(/No current data/);
  });

  test("API routes are not redirected to a language and unknown routes are 404", async ({
    request,
  }) => {
    const ok = await request.get("/api/v1/resorts", { maxRedirects: 0 });
    expect(ok.status()).toBe(200);
    const missing = await request.get("/api/v1/does-not-exist", {
      maxRedirects: 0,
    });
    expect(missing.status()).toBe(404);
  });
});
