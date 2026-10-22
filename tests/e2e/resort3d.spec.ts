import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { pretendHardwareGpu, startMap } from "./map-helpers";

/*
 * Resort maps in 3D, with the recorded bulletins served by the e2e feed stub:
 * St. Anton (Tyrol) and Verbier (Switzerland) have one current region each, Disentis is covered by SLF
 * but has no bulletin in the feed, and Kasprowy Wierch (Poland) is not covered by any feed we read.
 */
const cases = [
  { slug: "st-anton", name: "St. Anton am Arlberg", coloured: "1" },
  { slug: "verbier", name: "Verbier", coloured: "1" },
  { slug: "disentis", name: "Disentis 3000", coloured: "0" },
  {
    slug: "kasprowy-wierch",
    name: "Kasprowy Wierch (Zakopane)",
    coloured: "0",
  },
];

test.describe("3D resort maps", () => {
  for (const c of cases) {
    test(`${c.slug}: 3D terrain, marker, and colour only where a bulletin is current`, async ({
      page,
    }) => {
      await pretendHardwareGpu(page);
      await page.goto(`/en/resorts/${c.slug}`);
      const section = page.getByRole("region", {
        name: "Avalanche region map",
      });
      await expect(
        section.getByRole("button", { name: "3D view" }),
      ).toHaveAttribute("aria-pressed", "true");
      const map = await startMap(page);
      await expect(map).toHaveAttribute("data-map-status", "ready");
      await expect(map).toHaveAttribute("data-view", "3d");
      await expect(map).toHaveAttribute("data-coloured", c.coloured);
      await expect(map.getByRole("img", { name: c.name })).toBeVisible();
      await expect(
        section.getByText(/3D terrain is for orientation only/),
      ).toBeVisible();
    });
  }

  test("uses the same 2D/3D choice as the avalanche page", async ({ page }) => {
    await pretendHardwareGpu(page);
    await page.goto("/en/avalanche");
    await page.getByRole("button", { name: "3D view" }).click();
    await expect(page.getByRole("button", { name: "3D view" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await page.goto("/en/resorts/st-anton");
    const toggle = page
      .getByRole("region", { name: "Avalanche region map" })
      .getByRole("button", { name: "3D view" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const map = await startMap(page);
    await expect(map).toHaveAttribute("data-view", "2d");
    await toggle.click();
    await expect(map).toHaveAttribute("data-view", "3d");
  });

  test("phones start the resort map in 2D", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await pretendHardwareGpu(page);
    await page.goto("/en/resorts/verbier");
    await expect(
      page
        .getByRole("region", { name: "Avalanche region map" })
        .getByRole("button", { name: "3D view" }),
    ).toHaveAttribute("aria-pressed", "false");
    await context.close();
  });

  test("software rendering keeps resort maps in 2D", async ({ page }) => {
    await page.goto("/en/resorts/st-anton");
    const map = await startMap(page);
    await expect(map).toHaveAttribute("data-view", "2d");
    await expect(page.getByRole("button", { name: "3D view" })).toBeDisabled();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`no axe violations on a resort page with the 3D map running (${theme})`, async ({
      page,
    }) => {
      await pretendHardwareGpu(page);
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto("/en/resorts/st-anton");
      const map = await startMap(page);
      await expect(map).toHaveAttribute("data-view", "3d");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 140)}`,
        ),
      ).toEqual([]);
    });
  }
});
