import { expect, test } from "@playwright/test";

const START = { latitude: 47.1234567, longitude: 11.7654321 };
// About 11 m north per step: one step per second is ~40 km/h.
const STEP_DEG = 0.0001;

test.describe("ski-day tracker", () => {
  test("measures a run from GPS, saves the day on the device, and never sends positions", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ ...START, accuracy: 5 });
    const sent: string[] = [];
    page.on("request", (r) => sent.push(`${r.url()} ${r.postData() ?? ""}`));

    await page.goto("/en/track");
    await expect(
      page.getByText(/not sent anywhere and not stored/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start ski day" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    for (let i = 1; i <= 8; i++) {
      await page.waitForTimeout(1000);
      await context.setGeolocation({
        latitude: START.latitude + i * STEP_DEG,
        longitude: START.longitude,
        accuracy: 5,
      });
    }
    await expect
      .poll(async () =>
        Number(
          await page
            .getByTestId("current-speed")
            .innerText()
            .then((s) => s.match(/\d+/)?.[0]),
        ),
      )
      .toBeGreaterThan(20);

    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByText(/Ski day saved:/)).toBeVisible();
    await page.reload();
    const days = page.getByTestId("ski-days").getByRole("listitem");
    await expect(days).toHaveCount(1);
    await expect(days.first()).toContainText("km");

    const leaks = sent.filter((s) =>
      /47[.,]?12|11[.,]?76|1234567|7654321/.test(s),
    );
    expect(leaks).toEqual([]);

    await days
      .first()
      .getByRole("button", { name: /Delete the ski day of/ })
      .click();
    await expect(page.getByText("No ski days saved yet.")).toBeVisible();
  });

  test("without location permission it explains why it cannot measure", async ({
    page,
  }) => {
    await page.goto("/en/track");
    await page.getByRole("button", { name: "Start ski day" }).click();
    await expect(
      page.getByText(/Location access was not allowed/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start ski day" }),
    ).toBeVisible();
  });

  test("Polish", async ({ page }) => {
    await page.goto("/pl/track");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Licznik dnia na nartach",
    );
    await expect(
      page.getByRole("button", { name: "Zacznij dzień" }),
    ).toBeVisible();
  });
});
