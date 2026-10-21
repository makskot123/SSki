import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Expectations come from the raw recorded bulletins that the e2e feed stub serves (re-dated to "now").
type Raw = {
  regions: { regionID: string; name: string }[];
  dangerRatings: { mainValue: string }[];
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
const WORD = ["", "Low", "Moderate", "Considerable", "High", "Very high"];

function region(id: string) {
  const b = bulletins.find((x) => x.regions.some((r) => r.regionID === id));
  if (!b) throw new Error(`${id} is not in the fixtures`);
  return {
    name: b.regions.find((r) => r.regionID === id)!.name,
    level: Math.max(...b.dangerRatings.map((r) => LEVEL[r.mainValue] ?? 0)),
  };
}

const section = (
  page: import("@playwright/test").Page,
  name = "Avalanche situation",
) => page.getByRole("region", { name });

test.describe("resort page: avalanche situation in each state", () => {
  test("Tyrol (St. Anton): current level, region name, validity, source and map deep link", async ({
    page,
  }) => {
    const r = region("AT-07-07");
    await page.goto("/en/resorts/st-anton");
    const s = section(page);
    await expect(s.getByText(r.name)).toBeVisible();
    await expect(
      s.getByText(WORD[r.level], { exact: true }).first(),
    ).toBeVisible();
    await expect(s.getByText(/Valid until/)).toBeVisible();
    await expect(s.getByText(/Source: Avalanche\.report/)).toBeVisible();
    await expect(
      s.getByText(/Not a substitute for the official bulletin/),
    ).toBeVisible();

    const link = s.getByRole("link", { name: "Details on the avalanche map" });
    await expect(link).toHaveAttribute("href", /\/en\/avalanche#r=AT-07-07$/);
    await link.click();
    await expect(page).toHaveURL(/\/en\/avalanche#r=AT-07-07$/);
    const panel = page.getByRole("region", { name: "Region details" });
    await expect(panel.getByRole("heading", { level: 3 })).toHaveText(r.name);
    await expect(
      panel.getByText(WORD[r.level], { exact: true }).first(),
    ).toBeVisible();
  });

  test("Switzerland (Verbier): current level from SLF with attribution", async ({
    page,
  }) => {
    const r = region("CH-4115");
    await page.goto("/en/resorts/verbier");
    const s = section(page);
    await expect(s.getByText(r.name)).toBeVisible();
    await expect(
      s.getByText(WORD[r.level], { exact: true }).first(),
    ).toBeVisible();
    await expect(
      s.getByText(
        /Source: WSL Institute for Snow and Avalanche Research SLF, CC BY 4\.0/,
      ),
    ).toBeVisible();
  });

  test("two regions (Andermatt): the one with a bulletin shows a level, the other 'No current data'", async ({
    page,
  }) => {
    const r = region("CH-2224");
    await page.goto("/en/resorts/andermatt");
    const s = section(page);
    await expect(s.getByText(r.name)).toBeVisible();
    await expect(s.getByText("No current data", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      s.getByText(WORD[r.level], { exact: true }).first(),
    ).toBeVisible();
  });

  test("covered but the feed has no bulletin (Disentis): says so, no level, official link", async ({
    page,
  }) => {
    await page.goto("/en/resorts/disentis");
    const s = section(page);
    await expect(s.getByText("No current data", { exact: true })).toBeVisible();
    await expect(
      s.getByText(/has no bulletin for this resort's region/),
    ).toBeVisible();
    for (const w of WORD.slice(1))
      await expect(s.getByText(w, { exact: true })).toHaveCount(0);
    await expect(s.getByRole("link", { name: /SLF/ })).toBeVisible();
    await expect(
      s.getByText(/Not a substitute for the official bulletin/),
    ).toBeVisible();
  });

  test("not covered (Poland): link-out to the official services, never a level", async ({
    page,
  }) => {
    await page.goto("/en/resorts/kasprowy-wierch");
    const s = section(page);
    await expect(
      s.getByText(/We do not display bulletins for this region/),
    ).toBeVisible();
    await expect(
      s.getByRole("link", { name: "Official avalanche bulletin" }),
    ).toHaveAttribute("href", /topr\.pl/);
    for (const w of WORD.slice(1))
      await expect(s.getByText(w, { exact: true })).toHaveCount(0);
  });

  test("not covered (France): official Météo-France link", async ({ page }) => {
    await page.goto("/en/resorts/chamonix");
    await expect(
      section(page).getByRole("link", { name: /Meteo France/i }),
    ).toHaveAttribute("href", /meteofrance/);
  });

  test("no official service (Bulgaria): says so and shows no avalanche map", async ({
    page,
  }) => {
    await page.goto("/en/resorts/bansko");
    await expect(
      section(page).getByText(
        /No official avalanche service is known for this area/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Avalanche region map" }),
    ).toHaveCount(0);
  });

  test("Polish wording", async ({ page }) => {
    const r = region("AT-07-07");
    await page.goto("/pl/resorts/st-anton");
    const s = page.getByRole("region", { name: "Sytuacja lawinowa" });
    await expect(s.getByText(r.name)).toBeVisible();
    await expect(
      s
        .getByText(
          ["", "Niskie", "Umiarkowane", "Znaczne", "Duże", "Bardzo duże"][
            r.level
          ],
          { exact: true },
        )
        .first(),
    ).toBeVisible();
  });
});

test.describe("resort page: region map", () => {
  test("stays out of the first load, then shows the resort's region coloured only where current", async ({
    page,
  }) => {
    const assets: string[] = [];
    page.on("request", (r) => {
      if (/maplibre|avalanche-regions\.json/.test(r.url()))
        assets.push(r.url());
    });
    await page.goto("/en/resorts/st-anton");
    await expect(
      page.getByRole("heading", { name: "Avalanche region map" }),
    ).toBeVisible();
    await expect(page.getByTestId("avalanche-map-placeholder")).toBeVisible();
    await page.waitForTimeout(1200);
    expect(assets).toEqual([]);

    // Wait for hydration, then move the mouse: that is itself the first interaction that starts the map.
    await page.waitForLoadState("networkidle");
    await page.mouse.move(150, 250);
    const map = page.getByTestId("avalanche-map");
    await expect(map).toHaveAttribute("data-map-status", /ready|error/, {
      timeout: 30_000,
    });
    if ((await map.getAttribute("data-map-status")) === "ready") {
      await expect(map).toHaveAttribute("data-coloured", "1"); // St. Anton has exactly one region with a current bulletin
      await expect(
        map.getByRole("img", { name: "St. Anton am Arlberg" }),
      ).toBeVisible(); // the marker
    }
  });

  test("a resort without a covered feed has the outline but no colour", async ({
    page,
  }) => {
    await page.goto("/en/resorts/kasprowy-wierch");
    // Wait for hydration, then move the mouse: that is itself the first interaction that starts the map.
    await page.waitForLoadState("networkidle");
    await page.mouse.move(150, 250);
    const map = page.getByTestId("avalanche-map");
    await expect(map).toHaveAttribute("data-map-status", /ready|error/, {
      timeout: 30_000,
    });
    if ((await map.getAttribute("data-map-status")) === "ready") {
      await expect(map).toHaveAttribute("data-coloured", "0");
    }
  });
});

test.describe("compare", () => {
  test("pick resorts on the ranking page and compare them side by side", async ({
    page,
  }) => {
    await page.goto("/en/resorts");
    await page
      .getByRole("checkbox", { name: "Compare St. Anton am Arlberg" })
      .check();
    await expect(page.getByText("Select at least one more.")).toBeVisible();
    await page.getByRole("checkbox", { name: "Compare Chamonix" }).check();
    await page.getByRole("checkbox", { name: "Compare Fieberbrunn" }).check();
    await expect(page.getByText("3 resorts selected (up to 3)")).toBeVisible();
    // The limit is enforced: a fourth cannot be added.
    await expect(
      page.getByRole("checkbox", { name: "Compare Zermatt" }),
    ).toBeDisabled();

    await page.getByRole("link", { name: "Compare side by side" }).click();
    await expect(page).toHaveURL(
      /\/en\/compare\?r=st-anton,chamonix,fieberbrunn$/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Compare resorts",
    );

    const table = page.getByRole("table", {
      name: "Side-by-side comparison of the selected resorts",
    });
    await expect(table.getByRole("columnheader")).toHaveText([
      "St. Anton am Arlberg",
      "Chamonix",
      "Fieberbrunn",
    ]);
    const avalanche = table.getByRole("row", { name: /Avalanche situation/ });
    const cells = avalanche.getByRole("cell");
    await expect(cells.nth(0)).toContainText(WORD[region("AT-07-07").level]);
    await expect(cells.nth(1)).toContainText("Not shown here");
    await expect(cells.nth(2)).toContainText(WORD[region("AT-07-18").level]);
    await expect(
      table.getByRole("row", { name: /Top elevation/ }),
    ).toContainText("3,842 m");
    await expect(page.getByText(/approximate estimates/)).toBeVisible();
  });

  test("the pickers change the comparison and the URL is shareable", async ({
    page,
  }) => {
    await page.goto("/en/compare?r=verbier,zermatt");
    await expect(
      page.getByRole("columnheader", { name: "Verbier" }),
    ).toBeVisible();
    await page.getByLabel("Resort 3").selectOption({ label: "Engelberg" });
    await expect(page).toHaveURL(/r=verbier,zermatt,engelberg$/);
    await expect(
      page.getByRole("columnheader", { name: "Engelberg" }),
    ).toBeVisible();
    await page.getByLabel("Resort 2").selectOption({ label: "None" });
    await expect(page).toHaveURL(/r=verbier,engelberg$/);
  });

  test("needs two resorts, ignores unknown ones and duplicates", async ({
    page,
  }) => {
    await page.goto("/en/compare?r=chamonix");
    await expect(
      page.getByText("Choose at least two resorts to compare."),
    ).toBeVisible();
    await page.goto("/en/compare?r=chamonix,atlantis,chamonix");
    await expect(
      page.getByText("Choose at least two resorts to compare."),
    ).toBeVisible();
    await page.goto(
      "/en/compare?r=chamonix,verbier,atlantis,zermatt,engelberg",
    );
    // Unknown slugs are ignored and the list is capped at three resorts.
    await expect(page.getByRole("table").getByRole("columnheader")).toHaveText([
      "Chamonix",
      "Verbier",
      "Zermatt",
    ]);
  });

  test("Polish page", async ({ page }) => {
    await page.goto("/pl/compare?r=verbier,bansko");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Porównaj ośrodki",
    );
    await expect(
      page.getByRole("cell", { name: /Brak znanej oficjalnej służby/ }),
    ).toBeVisible();
  });

  test("the resort page links to the comparison", async ({ page }) => {
    await page.goto("/en/resorts/verbier");
    await page
      .getByRole("link", { name: "Compare with other resorts" })
      .click();
    await expect(page).toHaveURL(/\/en\/compare\?r=verbier$/);
  });
});

for (const theme of ["light", "dark"] as const) {
  for (const route of [
    "/en/resorts/st-anton",
    "/en/resorts/disentis",
    "/en/resorts/kasprowy-wierch",
    "/en/resorts/bansko",
    "/pl/resorts/andermatt",
    "/en/compare?r=st-anton,chamonix,bansko",
    "/pl/compare?r=verbier,disentis",
    "/en/compare",
  ]) {
    test(`no axe violations on ${route} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(route);
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
