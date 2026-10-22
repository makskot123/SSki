import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/*
 * Playwright's Chromium renders WebGL in software (SwiftShader), which the app correctly refuses for 3D.
 * To test the 3D path, these tests make the renderer report a hardware GPU name. Rendering itself still
 * works (slowly); the tests check state, not pixels.
 */
async function pretendHardwareGpu(page: Page) {
  await page.addInitScript(() => {
    const UNMASKED_RENDERER = 0x9246;
    for (const proto of [
      WebGL2RenderingContext.prototype,
      WebGLRenderingContext.prototype,
    ]) {
      const original = proto.getParameter;
      proto.getParameter = function (this: WebGLRenderingContext, p: number) {
        return p === UNMASKED_RENDERER
          ? "Test GPU (e2e)"
          : original.call(this, p);
      } as typeof original;
    }
  });
}

async function startMap(page: Page) {
  // Wait for hydration, then any mouse movement starts the map (it is deferred until interaction).
  await expect(page.getByTestId("avalanche-map-placeholder")).toHaveAttribute(
    "data-armed",
    "true",
  );
  await page.mouse.move(150, 250);
  const map = page.getByTestId("avalanche-map");
  await expect(map).toHaveAttribute("data-map-status", /ready|error/, {
    timeout: 30_000,
  });
  return map;
}

const toggle = (page: Page) => page.getByRole("button", { name: "3D view" });

test.describe("3D avalanche map", () => {
  test("desktop with a GPU starts in 3D and shows terrain", async ({
    page,
  }) => {
    await pretendHardwareGpu(page);
    await page.goto("/en/avalanche");
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    const map = await startMap(page);
    await expect(map).toHaveAttribute("data-map-status", "ready");
    await expect(map).toHaveAttribute("data-view", "3d");
    await expect(
      page.getByText(/3D terrain is for orientation only/),
    ).toBeVisible();
  });

  test("switching to 2D is remembered after a reload", async ({ page }) => {
    await pretendHardwareGpu(page);
    await page.goto("/en/avalanche");
    const map = await startMap(page);
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(map).toHaveAttribute("data-view", "2d");

    await page.reload();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    const again = await startMap(page);
    await expect(again).toHaveAttribute("data-view", "2d");

    await toggle(page).click();
    await expect(again).toHaveAttribute("data-view", "3d");
  });

  test("phones start in 2D but can switch to 3D", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await pretendHardwareGpu(page);
    await page.goto("/en/avalanche");
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(toggle(page)).toBeEnabled();
    await toggle(page).tap();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
    await context.close();
  });

  test("software rendering (no GPU): 3D is disabled with the reason, the 2D map still works", async ({
    page,
  }) => {
    // No pretending here: this is Playwright's real SwiftShader renderer.
    await page.goto("/en/avalanche");
    // Capability is only checked once the map starts (keeps the first load fast).
    await expect(toggle(page)).toBeEnabled();
    const map = await startMap(page);
    await expect(toggle(page)).toBeDisabled();
    await expect(
      page.getByText(/needs hardware graphics acceleration/),
    ).toBeVisible();
    await expect(map).toHaveAttribute("data-map-status", "ready");
    await expect(map).toHaveAttribute("data-view", "2d");
  });

  test("a saved 3D choice is ignored on a device that cannot do 3D", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("freeride-atlas:map-view:v1", "3d"),
    );
    await page.goto("/en/avalanche");
    const map = await startMap(page);
    await expect(toggle(page)).toBeDisabled();
    await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(map).toHaveAttribute("data-view", "2d");
  });

  test("no WebGL2 at all: no 3D, a clear message instead of the map, and the list still works", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type === "webgl2") return null;
        return (original as (...a: unknown[]) => unknown).call(
          this,
          type,
          ...rest,
        );
      } as typeof original;
    });
    await page.goto("/en/avalanche");
    const map = await startMap(page);
    await expect(toggle(page)).toBeDisabled();
    await expect(map).toHaveAttribute("data-map-status", "error");
    await expect(
      page.getByText(/could not be loaded in this browser/),
    ).toBeVisible();
    await page.locator("#region-list").getByRole("button").first().click();
    await expect(
      page
        .getByRole("region", { name: "Region details" })
        .getByRole("heading", { level: 3 }),
    ).toBeVisible();
  });

  test("selecting a region moves the camera to it, in 3D and in 2D", async ({
    page,
  }) => {
    await pretendHardwareGpu(page);
    await page.goto("/en/avalanche");
    const map = await startMap(page);
    const first = page.locator("#region-list").getByRole("button").first();
    await first.click();
    const id = await page
      .getByRole("region", { name: "Region details" })
      .locator("p.text-xs")
      .first()
      .textContent();
    await expect(map).toHaveAttribute("data-focused", id!.trim(), {
      timeout: 15_000,
    });
    await expect(map).toHaveAttribute("data-view", "3d");

    await toggle(page).click();
    const second = page.locator("#region-list").getByRole("button").nth(1);
    await second.click();
    const id2 = await page
      .getByRole("region", { name: "Region details" })
      .locator("p.text-xs")
      .first()
      .textContent();
    await expect(map).toHaveAttribute("data-focused", id2!.trim(), {
      timeout: 15_000,
    });
    await expect(map).toHaveAttribute("data-view", "2d");
  });

  test("a deep link from a resort page focuses the region on the map", async ({
    page,
  }) => {
    await pretendHardwareGpu(page);
    await page.goto("/en/avalanche#r=AT-07-07");
    const map = await startMap(page);
    await expect(map).toHaveAttribute("data-focused", "AT-07-07", {
      timeout: 15_000,
    });
  });

  test("3D never colours anything but current bulletins", async ({ page }) => {
    await pretendHardwareGpu(page);
    await page.goto("/en/avalanche");
    const summary = await page
      .getByText(/regions? (has|have) a current bulletin/)
      .textContent();
    const current = Number(summary!.match(/\d+/)![0]);
    const map = await startMap(page);
    await expect(map).toHaveAttribute("data-view", "3d");
    await expect(map).toHaveAttribute("data-coloured", String(current));
  });

  test("Polish toggle and hint", async ({ page }) => {
    await pretendHardwareGpu(page);
    await page.goto("/pl/avalanche");
    await expect(
      page.getByRole("button", { name: "Widok 3D" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText(/Teren 3D służy tylko do orientacji/),
    ).toBeVisible();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`no axe violations with the 3D map running (${theme})`, async ({
      page,
    }) => {
      await pretendHardwareGpu(page);
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto("/en/avalanche");
      const map = await startMap(page);
      await expect(map).toHaveAttribute("data-view", "3d");
      await page.locator("#region-list").getByRole("button").first().click();
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
