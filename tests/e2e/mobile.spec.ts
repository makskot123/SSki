import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs in the "iphone" (WebKit) and "pixel" (Chromium) projects only, see playwright.config.ts.

const PAGES = [
  "/en",
  "/en/resorts",
  "/en/resorts/chamonix",
  "/en/compare?r=chamonix,verbier",
  "/en/avalanche",
  "/en/powder",
  "/en/safety",
  "/en/safety/checklist",
  "/en/safety/quiz",
  "/en/safety/aspects",
  "/en/safety/gear",
  "/en/safety/gear/transceiver",
  "/en/how-we-rank",
  "/en/planner",
  "/en/track",
  "/pl/track",
  "/pl",
  "/pl/resorts",
  "/pl/avalanche",
  "/pl/safety/checklist",
];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;
    // Name the widest offenders to make a failure easy to fix.
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 120));
  });
}

/** Visible controls smaller than 44 x 44 px (checkboxes and radios count their label). */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const MIN = 44;
    const out: string[] = [];
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}"`;
    const visible = (r: DOMRect) => r.width > 0 && r.height > 0;
    const controls = document.querySelectorAll<HTMLElement>(
      "[data-site-header] a, [data-testid=bottom-tabs] a, button, select, summary, input",
    );
    for (const el of Array.from(controls)) {
      if (el.closest(".maplibregl-ctrl, .sr-only") || el.closest("[inert]"))
        continue;
      const input = el instanceof HTMLInputElement ? el : null;
      if (input?.type === "hidden") continue;
      const target =
        input && ["checkbox", "radio"].includes(input.type)
          ? (input.closest("label") ?? input)
          : el;
      const r = target.getBoundingClientRect();
      if (!visible(r)) continue;
      const tooNarrow = el.tagName === "BUTTON" && r.width < MIN - 0.5;
      if (r.height < MIN - 0.5 || tooNarrow) {
        out.push(
          `${describe(target)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        );
      }
    }
    return out;
  });
}

test.describe("phone app shell", () => {
  test("no page scrolls sideways, and every control is at least 44 px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const problems: Record<string, unknown> = {};
    for (const url of PAGES) {
      await page.goto(url);
      const overflow = await horizontalOverflow(page);
      const small = await smallTargets(page);
      if (overflow) problems[`${url} overflow`] = overflow;
      if (small.length) problems[`${url} small`] = [...new Set(small)];
    }
    expect(problems).toEqual({});
    // The narrowest phones still in common use.
    await page.setViewportSize({ width: 320, height: 640 });
    for (const url of PAGES) {
      await page.goto(url);
      expect(await horizontalOverflow(page), `${url} at 320 px`).toBeNull();
    }
  });

  test("sections are bottom tabs instead of the header menu", async ({
    page,
  }) => {
    await page.goto("/en");
    const tabs = page.getByTestId("bottom-tabs");
    await expect(tabs).toBeVisible();
    await expect(page.locator("header nav")).toBeHidden();
    await expect(tabs.getByRole("link")).toHaveCount(6);
    await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await tabs.getByRole("link", { name: "Avalanche" }).click();
    await expect(page).toHaveURL(/\/en\/avalanche$/);
    await expect(tabs.getByRole("link", { name: "Avalanche" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Sub-pages keep their section highlighted.
    await page.goto("/pl/safety/quiz");
    await expect(
      page
        .getByTestId("bottom-tabs")
        .getByRole("link", { name: "Bezpiecznie" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("the tabs never cover the end of the page", async ({ page }) => {
    await page.goto("/en/safety");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const tabs = await page.getByTestId("bottom-tabs").boundingBox();
    const last = await page.locator("footer > div > *").last().boundingBox();
    expect(tabs && last).toBeTruthy();
    expect(last!.y + last!.height).toBeLessThanOrEqual(tabs!.y + 0.5);
  });

  test("the avalanche map opens full screen and closes again", async ({
    page,
  }) => {
    await page.goto("/en/avalanche");
    const column = page.getByTestId("map-column");
    await page.getByRole("button", { name: "Full screen" }).click();

    const dialog = page.getByRole("dialog", {
      name: "Avalanche map, full screen",
    });
    await expect(dialog).toBeVisible();
    const box = await column.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).toEqual({
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });
    // Asking for the full-screen map starts it (no second tap on "Show interactive map").
    await expect(page.getByTestId("avalanche-map-placeholder")).toHaveCount(0);
    // The page behind can't be reached.
    await expect(page.getByRole("banner")).toHaveAttribute("inert", "");
    await expect(page.getByTestId("bottom-tabs")).toHaveAttribute("inert", "");
    const close = page.getByRole("button", { name: "Close full screen" });
    await expect(close).toBeFocused();

    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("banner")).not.toHaveAttribute("inert", "");
    await expect(
      page.getByRole("button", { name: "Full screen" }),
    ).toBeFocused();
  });

  test("Escape also closes the full-screen map", async ({ page }) => {
    await page.goto("/en/avalanche");
    await page.getByRole("button", { name: "Full screen" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("axe: no accessibility violations on phone screens", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const url of PAGES) {
      await page.goto(url);
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, theme);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(results.violations, `${url} (${theme})`).toEqual([]);
      }
    }
  });
});

test("dark mode follows the system until the visitor picks a theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: /^(Dark|Light) mode$/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
