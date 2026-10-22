import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import gear from "../../data/gear.json";

const CATEGORIES = ["transceiver", "probe", "shovel", "airbag", "helmet"];

test.describe("gear guide", () => {
  test("overview: honest about the method, minimum standards for every category, kits only when complete", async ({
    page,
  }) => {
    await page.goto("/en/safety/gear");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Gear guide",
    );
    await expect(
      page.getByText(/We do not test gear, nothing here is sponsored/),
    ).toBeVisible();
    await expect(
      page.getByText(/no substitute for an avalanche course/).first(),
    ).toBeVisible();
    for (const name of [
      "Avalanche transceivers",
      "Avalanche probes",
      "Avalanche shovels",
      "Avalanche airbags",
      "Helmets",
    ]) {
      await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    }
    await expect(page.getByText("At least 240 cm long")).toBeVisible();
    await expect(
      page.getByText("Certified to EN 16716 (avalanche airbag systems)"),
    ).toBeVisible();

    if (gear.products.length === 0) {
      // Nothing is invented: until products are verified, the page says so and offers no kit.
      await expect(page.getByText(/No products are listed yet/)).toHaveCount(5);
      await expect(page.getByTestId("kit-essential")).toContainText(
        "Shown once every item in this kit has at least one checked product.",
      );
    }
  });

  test("each category page shows minimums and criteria, and links back", async ({
    page,
  }) => {
    for (const category of CATEGORIES) {
      await page.goto(`/en/safety/gear/${category}`);
      await expect(
        page.getByRole("heading", { name: "Minimum standard to be ranked" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "What the performance score looks at",
        }),
      ).toBeVisible();
    }
    await page.getByRole("link", { name: "← Gear guide" }).click();
    await expect(page).toHaveURL(/\/en\/safety\/gear$/);
  });

  test("an unknown category is a 404", async ({ page }) => {
    const res = await page.goto("/en/safety/gear/skis");
    expect(res?.status()).toBe(404);
  });

  test("reachable from the safety page and from the checklist", async ({
    page,
  }) => {
    await page.goto("/en/safety");
    await page.getByRole("link", { name: /Gear guide/ }).click();
    await expect(page).toHaveURL(/\/en\/safety\/gear$/);

    await page.goto("/en/safety/checklist");
    await page
      .getByRole("link", { name: "What to look for: Avalanche probes" })
      .click();
    await expect(page).toHaveURL(/\/en\/safety\/gear\/probe$/);
  });

  test("Polish", async ({ page }) => {
    await page.goto("/pl/safety/gear");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Poradnik sprzętowy",
    );
    await expect(page.getByText("Co najmniej 240 cm długości")).toBeVisible();
  });

  test("axe: no violations on gear pages", async ({ page }) => {
    for (const url of [
      "/en/safety/gear",
      "/en/safety/gear/transceiver",
      "/pl/safety/gear",
    ]) {
      await page.goto(url);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations, url).toEqual([]);
    }
  });
});
