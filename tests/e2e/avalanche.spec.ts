import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The e2e feed stub serves these recorded bulletins re-dated to "now" (see feed-stub.mjs).
// Expectations are computed here from the raw files, independently of the app's own parser.
type Raw = {
  regions: { regionID: string; name: string }[];
  dangerRatings: { mainValue: string }[];
  publicationTime: string;
};
const load = (name: string): Raw[] =>
  JSON.parse(
    readFileSync(path.join(__dirname, "../fixtures/avalanche", name), "utf8"),
  ).bulletins;
const bulletins = [
  ...load("tyrol-2026-02-15.json"),
  ...load("slf-2026-02-15.json"),
];

const LEVEL: Record<string, number> = {
  low: 1,
  moderate: 2,
  considerable: 3,
  high: 4,
  very_high: 5,
};
const maxLevel = (b: Raw) =>
  Math.max(...b.dangerRatings.map((r) => LEVEL[r.mainValue] ?? 0));
const regionIds = new Set(
  bulletins.flatMap((b) => b.regions.map((r) => r.regionID)),
);

/** A region covered by exactly one bulletin, so the expected level is unambiguous. */
function uniqueRegion(prefix: string) {
  for (const b of bulletins) {
    for (const r of b.regions) {
      if (
        r.regionID.startsWith(prefix) &&
        bulletins.filter((x) =>
          x.regions.some((y) => y.regionID === r.regionID),
        ).length === 1
      ) {
        return { id: r.regionID, name: r.name, level: maxLevel(b) };
      }
    }
  }
  throw new Error(`no unique region for ${prefix}`);
}

const EN_LEVEL = ["", "Low", "Moderate", "Considerable", "High", "Very high"];
const PL_LEVEL = [
  "",
  "Niskie",
  "Umiarkowane",
  "Znaczne",
  "Duże",
  "Bardzo duże",
];

test("summary, disclaimer and feed status reflect the live feeds", async ({
  page,
}) => {
  await page.goto("/en/avalanche");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Avalanche meter",
  );
  await expect(
    page
      .getByText(
        "Not a substitute for the official bulletin. Always read the full bulletin and check conditions on site.",
      )
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText(`${regionIds.size} regions have a current bulletin`),
  ).toBeVisible();
  await expect(
    page.getByText(/Avalanche\.report .*: online, 6 bulletins received/),
  ).toBeVisible();
  await expect(
    page.getByText(
      /WSL Institute for Snow and Avalanche Research SLF: online, 3 bulletins received/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Bulletins: .*WSL Institute for Snow and Avalanche Research SLF \(CC BY 4\.0\)/,
    ),
  ).toBeVisible();
});

test("selecting a region from the list shows its official bulletin", async ({
  page,
}) => {
  const region = uniqueRegion("CH-");
  await page.goto("/en/avalanche");

  const list = page.locator("#region-list");
  await list.getByRole("button", { name: new RegExp(region.name) }).click();

  const panel = page.getByRole("region", { name: "Region details" });
  await expect(panel.getByRole("heading", { level: 3 })).toHaveText(
    region.name,
  );
  await expect(panel.getByText(region.id, { exact: true })).toBeVisible();
  // The danger level is printed as number + word, not only as a colour.
  await expect(
    panel.getByText(EN_LEVEL[region.level], { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByRole("img", { name: /Affected aspects: / }).first(),
  ).toBeVisible();
  await expect(
    panel.getByRole("link", { name: "Read the full official bulletin" }),
  ).toHaveAttribute(
    "href",
    "https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/",
  );
  await expect(
    panel.getByText(
      "Source: WSL Institute for Snow and Avalanche Research SLF, CC BY 4.0",
    ),
  ).toBeVisible();
  await expect(
    panel.getByText(/Not a substitute for the official bulletin/),
  ).toBeVisible();
});

test("the region list works from the keyboard", async ({ page }) => {
  await page.goto("/en/avalanche");
  const first = page.locator("#region-list").getByRole("button").first();
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(
    page
      .getByRole("region", { name: "Region details" })
      .getByRole("heading", { level: 3 }),
  ).toBeVisible();

  // The skip link lets keyboard users jump past the map.
  await page.goto("/en/avalanche");
  const skip = page.getByRole("link", {
    name: "Skip the map and go to the region list",
  });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#region-list$/);
});

test("the map stays out of the first load and starts on interaction", async ({
  page,
}) => {
  const mapAssets: string[] = [];
  page.on("request", (r) => {
    if (/maplibre|avalanche-regions\.json/.test(r.url()))
      mapAssets.push(r.url());
  });
  await page.goto("/en/avalanche");
  await expect(page.getByTestId("avalanche-map-placeholder")).toBeVisible();
  // The region list and panel are usable without the map.
  await expect(
    page.locator("#region-list").getByRole("button").first(),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  expect(mapAssets).toEqual([]);

  // Any real interaction starts the map.
  await page.mouse.move(200, 300);
  const map = page.getByTestId("avalanche-map");
  await expect(map).toHaveAttribute("data-map-status", /ready|error/, {
    timeout: 30_000,
  });
  expect(mapAssets.length).toBeGreaterThan(0);
});

test("the map button works from the keyboard without any mouse movement", async ({
  page,
}) => {
  await page.goto("/en/avalanche");
  const button = page.getByRole("button", { name: "Show interactive map" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("avalanche-map")).toHaveAttribute(
    "data-map-status",
    /ready|error/,
    { timeout: 30_000 },
  );
});

test("the map loads and colours exactly the regions with a current bulletin", async ({
  page,
}) => {
  await page.goto("/en/avalanche");
  await page.getByRole("button", { name: "Show interactive map" }).click();
  const map = page.getByTestId("avalanche-map");
  await expect(map).toHaveAttribute("data-map-status", /ready|error/, {
    timeout: 30_000,
  });
  const status = await map.getAttribute("data-map-status");
  if (status === "error") {
    // No WebGL in this browser: the list is the complete fallback and the page says so.
    await expect(
      page.getByText(/could not be loaded in this browser/),
    ).toBeVisible();
    return;
  }
  await expect(map).toHaveAttribute("data-coloured", String(regionIds.size));
  await expect(map.locator("canvas")).toBeVisible();
  await expect(page.getByText("Danger level (EAWS scale)")).toBeVisible();
});

test("Polish page uses Polish level names and wording", async ({ page }) => {
  const region = uniqueRegion("AT-07");
  await page.goto("/pl/avalanche");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Lawinomierz",
  );
  await page
    .locator("#region-list")
    .getByRole("button", { name: new RegExp(region.name) })
    .click();
  const panel = page.getByRole("region", { name: "Szczegóły regionu" });
  await expect(
    panel.getByText(PL_LEVEL[region.level], { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByRole("link", { name: "Przeczytaj pełny oficjalny komunikat" }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const route of ["/en/avalanche", "/pl/avalanche"]) {
    test(`no axe violations on ${route} with a region selected (${theme})`, async ({
      page,
    }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(route);
      await page.locator("#region-list").getByRole("button").first().click();
      await expect(page.getByTestId("avalanche-map")).toHaveAttribute(
        "data-map-status",
        /ready|error/,
        { timeout: 30_000 },
      );
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes[0]?.html.slice(0, 120)}`,
        ),
      ).toEqual([]);
    });
  }
}
