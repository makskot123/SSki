// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { AspectRose } from "@/components/avalanche/aspect-rose";
import { DangerBadge } from "@/components/avalanche/danger-badge";
import {
  RegionPanel,
  type RegionMeta,
} from "@/components/avalanche/region-panel";
import { buildRegionIndex } from "@/lib/avalanche/freshness";
import { parseCaamlFeed } from "@/lib/avalanche/normalise";
import { PROVIDERS } from "@/lib/avalanche/providers";
import { bulletinFor, toView } from "@/lib/avalanche/view";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";

afterEach(cleanup);

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "../fixtures/avalanche", name),
      "utf8",
    ),
  );
const bulletins = parseCaamlFeed(fixture("slf-2026-02-15.json"), PROVIDERS.slf);
const REGION = "CH-6112";

const WORDS = ["Low", "Moderate", "Considerable", "High", "Very high"];

const meta: RegionMeta = {
  regions: {
    [REGION]: {
      n: ["Upper Valle Leventina", "Górna Valle Leventina"],
      o: "CH",
    },
    "CH-9999": {
      n: ["Somewhere with no bulletin", "Gdzieś bez komunikatu"],
      o: "CH",
    },
  },
  services: {
    CH: [{ name: "SLF", url: "https://whiterisk.ch/en/conditions" }],
  },
};

const renderPanel = (
  regionId: string | null,
  now: string,
  locale: "en" | "pl" = "en",
) =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : pl}
    >
      <RegionPanel
        regionId={regionId}
        view={toView(buildRegionIndex(bulletins, new Date(now)))}
        meta={meta}
      />
    </NextIntlClientProvider>,
  );

describe("RegionPanel: current bulletin", () => {
  const now = "2026-02-15T10:00:00Z";
  const expected = bulletinFor(
    toView(buildRegionIndex(bulletins, new Date(now))),
    REGION,
  )!;

  it("shows the highest level as number and word, the ratings and the official link", () => {
    renderPanel(REGION, now);
    expect(screen.getByText("Highest danger level")).toBeTruthy();
    expect(
      screen.getAllByText(WORDS[expected.maxDangerLevel! - 1], { exact: true })
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Upper Valle Leventina",
    );
    const link = screen.getByRole("link", {
      name: "Read the full official bulletin",
    });
    expect(link.getAttribute("href")).toBe(PROVIDERS.slf.sourceUrl);
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(
      screen.getByText(
        /Source: WSL Institute for Snow and Avalanche Research SLF, CC BY 4.0/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/Not a substitute for the official bulletin/),
    ).toBeTruthy();
  });

  it("lists the problems with an aspect rose each", () => {
    renderPanel(REGION, now);
    expect(
      screen.getAllByRole("img", { name: /Affected aspects:/ }).length,
    ).toBe(expected.problems.length);
  });

  it("uses Polish wording and the Polish region name", () => {
    renderPanel(REGION, now, "pl");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Górna Valle Leventina",
    );
    expect(screen.getByText("Najwyższy stopień zagrożenia")).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "Przeczytaj pełny oficjalny komunikat",
      }),
    ).toBeTruthy();
  });
});

describe("RegionPanel: out-of-date and missing data never show a level", () => {
  const levelText =
    /Level \d|Highest danger level|Danger ratings|Avalanche problems/;

  it("stale bulletin: says 'No current data', explains it, and shows no level at all", () => {
    const { container } = renderPanel(REGION, "2026-10-21T10:00:00Z");
    expect(screen.getByText("No current data")).toBeTruthy();
    expect(
      screen.getByText(/out of date, so its danger level is not shown/),
    ).toBeTruthy();
    expect(container.textContent).not.toMatch(levelText);
    for (const word of WORDS)
      expect(screen.queryByText(word, { exact: true })).toBeNull();
    expect(
      screen.queryAllByRole("img", { name: /Affected aspects/ }),
    ).toHaveLength(0);
    // The way to the official source is still there.
    expect(
      screen.getByRole("link", { name: "Read the full official bulletin" }),
    ).toBeTruthy();
  });

  it("a bulletin that only just expired is treated the same way", () => {
    const view = toView(
      buildRegionIndex(bulletins, new Date("2026-02-15T10:00:00Z")),
    );
    const validUntil = new Date(
      bulletinFor(view, REGION)!.validUntil,
    ).getTime();
    const { container } = renderPanel(
      REGION,
      new Date(validUntil + 60_000).toISOString(),
    );
    expect(screen.getByText("No current data")).toBeTruthy();
    expect(container.textContent).not.toMatch(levelText);
  });

  it("region without any bulletin: names the official warning service instead", () => {
    const { container } = renderPanel("CH-9999", "2026-02-15T10:00:00Z");
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "Somewhere with no bulletin",
    );
    expect(screen.getByText("No current data")).toBeTruthy();
    expect(
      screen.getByText(/None of the data sources we use covers this region/),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "SLF" }).getAttribute("href")).toBe(
      "https://whiterisk.ch/en/conditions",
    );
    expect(container.textContent).not.toMatch(levelText);
  });

  it("nothing selected: prompts instead of showing data", () => {
    renderPanel(null, "2026-02-15T10:00:00Z");
    expect(
      screen.getByText(/Select a region on the map or in the list/),
    ).toBeTruthy();
  });
});

describe("badges", () => {
  it("DangerBadge prints number and word for every level, never colour alone", () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const { container, unmount } = render(
        <NextIntlClientProvider locale="en" messages={en}>
          <DangerBadge level={level} />
        </NextIntlClientProvider>,
      );
      expect(container.textContent).toContain(String(level));
      expect(container.textContent).toContain(WORDS[level - 1]);
      unmount();
    }
  });

  it("AspectRose fills exactly the given aspects and describes them", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AspectRose aspects={["N", "NE", "NW"]} />
      </NextIntlClientProvider>,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-label")).toBe("Affected aspects: N, NE, NW");
    const filled = [...container.querySelectorAll("path")].filter(
      (p) => p.getAttribute("fill") !== "none",
    );
    expect(filled).toHaveLength(3);
  });

  it("AspectRose handles an empty aspect list", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AspectRose aspects={[]} />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe(
      "Affected aspects: No aspect given",
    );
  });
});
