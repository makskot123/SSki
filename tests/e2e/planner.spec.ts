import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const resorts: { slug: string; name: string; country: string }[] = JSON.parse(
  readFileSync(path.join(__dirname, "../../data/resorts.json"), "utf8"),
);
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

// e2e runs with FORCE_MOCK_DATA=1: the forecast is sample data, so it must not affect the order.

test.describe("trip planner", () => {
  test("reached from the home page; default shortlist lists every resort and labels sample data", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.getByRole("link", { name: "Plan a trip" }).click();
    await expect(page).toHaveURL(/\/en\/planner$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Trip planner",
    );
    const results = page.getByTestId("planner-results");
    await expect(results.getByRole("listitem")).toHaveCount(resorts.length);
    await expect(
      page.getByText(
        /forecast shown is sample data and is not used for the ranking/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/0% forecast snow for your dates, 100% resort score/),
    ).toBeVisible();
    await expect(
      page.getByText(/today's bulletin, not a forecast for your dates/),
    ).toBeVisible();
  });

  test("dates beyond the forecast horizon clearly say the forecast is not yet available", async ({
    page,
  }) => {
    await page.goto(`/en/planner?from=${day(30)}&to=${day(33)}`);
    await expect(
      page.getByText(/Forecast not yet available for these dates/),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("planner-results")
        .getByText("No forecast for your dates yet")
        .first(),
    ).toBeVisible();
  });

  test("the form filters by country and keeps the choice in the link", async ({
    page,
  }) => {
    await page.goto("/en/planner");
    await page.getByLabel("Country").selectOption("CH");
    await page.getByRole("button", { name: "Show shortlist" }).click();
    await expect(page).toHaveURL(/country=CH/);
    const swiss = resorts.filter((r) => r.country === "CH");
    const items = page
      .getByTestId("planner-results")
      .getByRole("heading", { level: 3 });
    await expect(items).toHaveCount(swiss.length);
    for (const r of swiss) {
      await expect(
        page.getByTestId("planner-results").getByRole("link", { name: r.name }),
      ).toBeVisible();
    }
    // Swiss resorts are covered by the (stubbed, current) SLF feed.
    await expect(page.getByText(/Valid until/).first()).toBeVisible();
  });

  test("past or reversed dates are corrected, with a note", async ({
    page,
  }) => {
    await page.goto(`/en/planner?from=2020-01-01&to=2019-12-01`);
    await expect(
      page.getByText(/Some of your input was adjusted/),
    ).toBeVisible();
    await expect(page.getByLabel("From")).toHaveValue(day(0));
  });

  test("only my saved resorts", async ({ page }) => {
    await page.goto("/en/planner?country=AT");
    await page.getByRole("checkbox", { name: "Only my saved resorts" }).check();
    await expect(
      page.getByText(/You have not saved any resorts in this list yet/),
    ).toBeVisible();
    await page
      .getByRole("checkbox", { name: "Only my saved resorts" })
      .uncheck();
    const first = resorts.find((r) => r.country === "AT")!;
    await page
      .getByRole("button", { name: `Save ${first.name} as a favourite` })
      .click();
    await page.getByRole("checkbox", { name: "Only my saved resorts" }).check();
    await expect(
      page.getByTestId("planner-results").getByRole("listitem"),
    ).toHaveCount(1);
  });

  test("print view hides the form and adds a blank checklist", async ({
    page,
  }) => {
    await page.goto("/en/planner");
    await page.emulateMedia({ media: "print" });
    await expect(
      page.getByRole("button", { name: "Show shortlist" }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Trip checklist" }),
    ).toBeVisible();
    await expect(
      page.getByText("Avalanche transceiver (beacon)"),
    ).toBeVisible();
  });

  test("Polish", async ({ page }) => {
    await page.goto(`/pl/planner?from=${day(30)}&to=${day(31)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Planer wyjazdu",
    );
    await expect(
      page.getByText(/Prognoza dla tych dat nie jest jeszcze dostępna/),
    ).toBeVisible();
  });
});
