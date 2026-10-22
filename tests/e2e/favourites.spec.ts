import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

type Seed = {
  slug: string;
  name: string;
  coordinates: { lat: number; lon: number };
};
const resorts: Seed[] = JSON.parse(
  readFileSync(path.join(__dirname, "../../data/resorts.json"), "utf8"),
);

// Near Innsbruck. Unusual decimals so they are easy to spot in any request.
const HERE = { latitude: 47.2654321, longitude: 11.3987654 };

/** Independent of the app's own code: plain haversine over the seed data. */
function expectedNearest(count: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const km = (s: Seed) => {
    const dLat = r(s.coordinates.lat - HERE.latitude);
    const dLon = r(s.coordinates.lon - HERE.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(r(HERE.latitude)) *
        Math.cos(r(s.coordinates.lat)) *
        Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  return [...resorts].sort((a, b) => km(a) - km(b)).slice(0, count);
}

test.describe("favourites", () => {
  test("a starred resort appears on the home page with its avalanche situation, and stays after a reload", async ({
    page,
  }) => {
    await page.goto("/en");
    await expect(page.getByText(/No saved resorts yet/)).toBeVisible();

    await page.goto("/en/resorts");
    const star = page.getByRole("button", {
      name: "Save Verbier as a favourite",
    });
    await expect(star).toHaveAttribute("aria-pressed", "false");
    await star.click();
    await expect(star).toHaveAttribute("aria-pressed", "true");

    await page.goto("/en");
    const mine = page.getByTestId("my-resorts");
    await expect(mine.getByRole("link", { name: "Verbier" })).toBeVisible();
    // Verbier is covered by the SLF feed; the stub serves current bulletins.
    await expect(mine.getByText(/Valid until/)).toBeVisible();
    await expect(
      mine.getByText(/WSL Institute for Snow and Avalanche Research SLF/),
    ).toBeVisible();
    // Next to the data, not only in the footer.
    await expect(
      page
        .getByRole("main")
        .getByText(/Not a substitute for the official bulletin/),
    ).toBeVisible();

    await page.reload();
    await expect(mine.getByRole("link", { name: "Verbier" })).toBeVisible();

    // The resort page shares the same saved list.
    await page.goto("/en/resorts/verbier");
    const detailStar = page.getByRole("button", {
      name: "Save Verbier as a favourite",
    });
    await expect(detailStar).toHaveAttribute("aria-pressed", "true");
    await detailStar.click();
    await page.goto("/en");
    await expect(page.getByText(/No saved resorts yet/)).toBeVisible();
  });

  test("Polish", async ({ page }) => {
    await page.goto("/pl/resorts/zermatt");
    await page
      .getByRole("button", { name: "Zapisz Zermatt w ulubionych" })
      .click();
    await page.goto("/pl");
    await expect(
      page.getByRole("heading", { name: "Twoje ośrodki" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("my-resorts").getByRole("link", { name: "Zermatt" }),
    ).toBeVisible();
  });
});

test.describe("near me", () => {
  test("lists the nearest resorts, and the location never leaves the device", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(HERE);
    const sent: string[] = [];
    page.on("request", (req) =>
      sent.push(`${req.url()} ${req.postData() ?? ""}`),
    );

    await page.goto("/en");
    await page.getByRole("button", { name: "Find resorts near me" }).click();
    const list = page.getByTestId("near-me");
    const expected = expectedNearest(5);
    await expect(list.getByRole("heading", { level: 3 })).toHaveText(
      expected.map((r) => r.name),
    );
    await expect(list.getByText(/km away/).first()).toBeVisible();

    // Let any late requests (prefetches, analytics, anything) happen, then inspect them all.
    await page.waitForTimeout(1000);
    const leaks = sent.filter((s) =>
      /47[.,]?26|11[.,]?39|2654321|3987654/.test(s.replace(/%2C/gi, ",")),
    );
    expect(leaks).toEqual([]);
    // Nor is it written to storage.
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toMatch(/47\.26|11\.39/);
  });

  test("without location permission the page still works and says so", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Find resorts near me" }).click();
    await expect(
      page.getByText(/Location access was not allowed/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse all resorts" }).last(),
    ).toBeVisible();
  });
});
