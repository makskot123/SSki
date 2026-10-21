import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home renders in both locales with translated nav", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Find your next powder day",
  );
  await expect(
    page.getByRole("link", { name: "Avalanche meter" }),
  ).toBeVisible();

  await page.goto("/pl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Znajdź swój następny dzień z puchem",
  );
  await expect(page.getByRole("link", { name: "Lawinomierz" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
});

test("resort list links to a resort detail page", async ({ page }) => {
  await page.goto("/en/resorts");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Freeride resorts",
  );
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { level: 2 }) }),
  ).toHaveCount(30);

  await page.getByRole("link", { name: "View Chamonix" }).click();
  await expect(page).toHaveURL(/\/en\/resorts\/chamonix$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chamonix");
  await expect(page.getByText("3,842 m")).toBeVisible();
});

test("unknown resort slug is a 404 and Polish detail page is translated", async ({
  page,
}) => {
  const res = await page.goto("/en/resorts/atlantis");
  expect(res?.status()).toBe(404);
  await page.goto("/pl/resorts/verbier");
  await expect(
    page.getByRole("heading", { name: "Najważniejsze informacje" }),
  ).toBeVisible();
});

test("dark mode toggle persists across reload", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme!);
});

test("unknown path shows localized 404", async ({ page }) => {
  const res = await page.goto("/en/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const path of [
    "/en",
    "/en/resorts",
    "/en/resorts/chamonix",
    "/pl/resorts/kasprowy-wierch",
  ]) {
    test(`no axe violations on ${path} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
