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

test("presets and sliders re-sort live without a reload and update the URL", async ({
  page,
}) => {
  await page.goto("/en/resorts");
  await page.evaluate(() => {
    (window as unknown as { __marker: number }).__marker = 1;
  });
  const names = () =>
    page.locator("ol h2").evaluateAll((els) => els.map((e) => e.textContent));
  const before = await names();

  await page.getByRole("button", { name: "Budget" }).click();
  await expect.poll(names).not.toEqual(before);
  await expect(page).toHaveURL(/price=5/);

  const priceSlider = page.getByRole("slider", {
    name: "Price (cheaper is better)",
  });
  await priceSlider.fill("0");
  await expect(page).toHaveURL(/price=0/);

  await page.getByRole("button", { name: "Reset all" }).click();
  await expect.poll(names).toEqual(before);
  await expect(page).not.toHaveURL(/\?/);
  expect(
    await page.evaluate(
      () => (window as unknown as { __marker: number }).__marker,
    ),
  ).toBe(1);
});

test("filters narrow the list and are restored from the URL", async ({
  page,
}) => {
  await page.goto("/en/resorts?country=PL,SK&guides=1");
  await expect(page.getByText(/^\d+ of 30 resorts$/)).toHaveText(
    "1 of 30 resorts",
  );
  await expect(page.getByRole("checkbox", { name: "Poland" })).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Has freeride guides" }),
  ).toBeChecked();

  await page.goto("/en/resorts");
  await page.getByRole("checkbox", { name: "Poland" }).check();
  await page.getByRole("checkbox", { name: "Slovakia" }).check();
  await expect(page.getByText(/^\d+ of 30 resorts$/)).toHaveText(
    "2 of 30 resorts",
  );
  await page.getByRole("checkbox", { name: "Has freeride guides" }).check();
  await expect(page.getByText(/^\d+ of 30 resorts$/)).toHaveText(
    "1 of 30 resorts",
  );

  await page
    .getByRole("combobox", { name: "Highest lift at least" })
    .selectOption("3500");
  await expect(
    page.getByText(
      "No resorts match these filters. Try loosening one of them.",
    ),
  ).toBeVisible();
});

test("how we rank page lists every factor", async ({ page }) => {
  await page.goto("/en/how-we-rank");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How we rank",
  );
  await expect(page.getByRole("row")).toHaveCount(10); // header + 9 factors
  await page.goto("/pl/how-we-rank");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Jak tworzymy ranking",
  );
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
    "/en/how-we-rank",
    "/pl/resorts?country=PL&maxPrice=50",
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
