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
  test(`no axe violations on home (${theme})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    await page.goto("/en");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
