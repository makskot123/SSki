import { expect, test, type Page } from "@playwright/test";

/** Waits until the service worker has finished installing (precache done) and controls this page. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () =>
          resolve(),
        ),
      );
    }
  });
}

test.describe("installable app", () => {
  test("the manifest is served and its icons exist", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBe("FreerideAtlas");
    expect(manifest.display).toBe("standalone");
    const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose);
    expect(purposes).toContain("maskable");
    for (const icon of manifest.icons) {
      const img = await request.get(icon.src);
      expect(img.ok(), icon.src).toBe(true);
      expect(img.headers()["content-type"]).toContain("image/png");
    }
    expect((await request.get("/apple-icon.png")).ok()).toBe(true);
  });

  test("Chrome reports no installability errors once the service worker runs", async ({
    page,
    context,
  }) => {
    await page.goto("/en");
    await waitForServiceWorker(page);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send(
      "Page.getInstallabilityErrors",
    );
    expect(installabilityErrors).toEqual([]);
  });

  test("the browser's install offer becomes an 'Install the app' button", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.evaluate(() => {
      const e = Object.assign(new Event("beforeinstallprompt"), {
        prompt: () => {
          (window as unknown as { __prompted: boolean }).__prompted = true;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(e);
    });
    await page.getByRole("button", { name: "Install the app" }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __prompted?: boolean }).__prompted,
      ),
    ).toBe(true);
  });
});

test.describe("offline", () => {
  test("safety tools work offline without having been visited, ticks are saved", async ({
    page,
    context,
  }) => {
    await page.goto("/en");
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await page.goto("/en/safety/checklist");
    await expect(
      page.getByText("You are offline.", { exact: false }),
    ).toBeVisible();
    const helmet = page.getByRole("checkbox", { name: "Helmet" });
    await helmet.check();
    await page.reload();
    await expect(helmet).toBeChecked();

    await page.goto("/en/safety/quiz");
    await expect(page.getByRole("radio").first()).toBeVisible();
    await page.getByRole("radio").first().check();
    await expect(page.getByRole("radio").first()).toBeChecked();

    // Coming back online must not reload the page and wipe a half-done quiz.
    await context.setOffline(false);
    await page.waitForTimeout(500);
    await expect(page.getByRole("radio").first()).toBeChecked();
    await context.setOffline(true);

    await page.goto("/pl/safety");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bezpieczeństwo",
    );
  });

  test("a page never saved falls back to the offline page in the right language", async ({
    page,
    context,
  }) => {
    await page.goto("/en");
    await waitForServiceWorker(page);
    await context.setOffline(true);

    await page.goto("/en/resorts/zermatt");
    await expect(
      page.getByRole("heading", { level: 1, name: "You are offline" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Gear and trip checklist" }),
    ).toBeVisible();

    await page.goto("/pl/resorts/zermatt");
    await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  });

  test("a saved avalanche page never shows an old bulletin as current", async ({
    page,
    context,
  }) => {
    await page.goto("/en");
    await waitForServiceWorker(page);
    // Visit online so the page is saved, with current (re-dated) bulletins.
    await page.goto("/en/avalanche");
    await expect(
      page.getByText(/No region has a current bulletin/),
    ).toHaveCount(0);

    // Two days later, without a connection: the saved page must not show a level.
    await context.setOffline(true);
    await page.clock.setFixedTime(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await page.goto("/en/avalanche");
    await expect(
      page.getByText("You are offline.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText(/No region has a current bulletin/),
    ).toBeVisible();
  });
});
