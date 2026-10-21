// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvalancheCell } from "@/components/compare/avalanche-cell";
import {
  ResortAvalancheSection,
  type ResortAvalancheProps,
} from "@/components/resort/resort-avalanche-section";
import { buildRegionIndex } from "@/lib/avalanche/freshness";
import { parseCaamlFeed } from "@/lib/avalanche/normalise";
import { PROVIDERS } from "@/lib/avalanche/providers";
import { resortAvalanche } from "@/lib/avalanche/resort-status";
import { getResortBySlug } from "@/lib/resorts";
import en from "@/messages/en.json";

// next-intl's navigation module needs Next's runtime; these tests only need plain links.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => "/",
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const load = (name: string) =>
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "../fixtures/avalanche", name),
      "utf8",
    ),
  );
const tyrol = parseCaamlFeed(load("tyrol-2026-02-15.json"), PROVIDERS.euregio);
const slf = parseCaamlFeed(load("slf-2026-02-15.json"), PROVIDERS.slf);

const DAY = "2026-02-15T10:00:00Z";
const live = {
  euregio: { state: "live" as const },
  slf: { state: "live" as const },
};
const WORDS = ["Low", "Moderate", "Considerable", "High", "Very high"];
const LEVEL_TEXT = /Level \d|Highest danger level/;

const links = [{ name: "LWD Tirol", url: "https://avalanche.report" }];

function analyse(slug: string, serverNow = DAY) {
  const index = buildRegionIndex([...tyrol, ...slf], new Date(serverNow));
  // Same naming rule as the page: the provider's own region name when there is one.
  return resortAvalanche(
    getResortBySlug(slug)!,
    index,
    live,
    (id) => index.get(id)?.bulletin.regionNames[id] ?? id,
  );
}

function section(slug: string, serverNow = DAY): ResortAvalancheProps {
  const a = analyse(slug, serverNow);
  if (a.kind !== "covered")
    return a.kind === "not_covered"
      ? { kind: "not_covered", links }
      : { kind: "no_service" };
  return {
    kind: "covered",
    regions: a.regions,
    feedsDown: [],
    links,
    renderedAt: serverNow,
  };
}

const renderSection = (props: ResortAvalancheProps) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ResortAvalancheSection {...props} />
    </NextIntlClientProvider>,
  );

describe("ResortAvalancheSection", () => {
  it("current bulletin: shows the level as number and word, validity, source and map link", () => {
    vi.useFakeTimers({ now: new Date(DAY), toFake: ["Date"] });
    const { container } = renderSection(section("st-anton"));
    expect(
      screen.getByText("Highest danger level in this resort's region(s)"),
    ).toBeTruthy();
    expect(container.textContent).toContain("Considerable");
    expect(screen.getByText("Lechtal Alps West")).toBeTruthy();
    expect(screen.getByText(/Valid until/)).toBeTruthy();
    expect(screen.getByText(/Source: Avalanche\.report/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Details on the avalanche map" })
        .getAttribute("href"),
    ).toContain("#r=AT-07-07");
    expect(
      screen.getByText(/Not a substitute for the official bulletin/),
    ).toBeTruthy();
  });

  it("SAFETY: a section rendered as current turns into 'No current data' when the visitor's clock is past expiry", () => {
    // The server rendered it on the day (current); the browser clock is in October (long expired).
    vi.useFakeTimers({
      now: new Date("2026-10-21T10:00:00Z"),
      toFake: ["Date"],
    });
    const { container } = renderSection(section("st-anton", DAY));
    expect(screen.getByText("No current data", { selector: "p" })).toBeTruthy();
    expect(container.textContent).not.toMatch(LEVEL_TEXT);
    for (const w of WORDS) expect(container.textContent).not.toContain(w);
    expect(screen.getByRole("link", { name: /LWD Tirol/ })).toBeTruthy();
  });

  it("SAFETY: flips from current to stale while the page stays open", () => {
    vi.useFakeTimers({ now: new Date(DAY) });
    const { container } = renderSection(section("st-anton"));
    expect(container.textContent).toContain("Considerable");

    act(() => {
      vi.setSystemTime(new Date("2026-02-16T20:00:00Z")); // well past the bulletin's validity
      vi.advanceTimersByTime(60_000);
    });
    expect(container.textContent).not.toContain("Considerable");
    expect(screen.getByText("No current data", { selector: "p" })).toBeTruthy();
  });

  it("SAFETY: a wrong device clock set far into the past cannot bring back a level for stale data", () => {
    vi.useFakeTimers({ now: new Date(DAY), toFake: ["Date"] });
    // Server rendered in October: every region is stale. The browser clock says February.
    const props = section("st-anton", "2026-10-21T10:00:00Z");
    const { container } = renderSection(props);
    expect(container.textContent).not.toMatch(LEVEL_TEXT);
    expect(screen.getByText("No current data", { selector: "p" })).toBeTruthy();
  });

  it("two regions: shows the current one with its level and the other as 'No current data'", () => {
    vi.useFakeTimers({ now: new Date(DAY), toFake: ["Date"] });
    renderSection(section("andermatt"));
    expect(screen.getByText("Southern Urseren")).toBeTruthy();
    expect(screen.getAllByText("No current data").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Considerable/).length).toBeGreaterThan(0);
  });

  it("covered but no bulletin in the feed (Disentis): says so and links to the official source", () => {
    vi.useFakeTimers({ now: new Date(DAY), toFake: ["Date"] });
    const { container } = renderSection(section("disentis"));
    expect(screen.getByText("No current data", { selector: "p" })).toBeTruthy();
    expect(
      screen.getByText(/has no bulletin for this resort's region/),
    ).toBeTruthy();
    expect(container.textContent).not.toMatch(LEVEL_TEXT);
    expect(screen.getByRole("link", { name: /LWD Tirol/ })).toBeTruthy();
  });

  it("names the feed that cannot be reached", () => {
    vi.useFakeTimers({ now: new Date(DAY), toFake: ["Date"] });
    const base = section("disentis");
    if (base.kind !== "covered") throw new Error("expected covered");
    renderSection({
      ...base,
      feedsDown: ["WSL Institute for Snow and Avalanche Research SLF"],
    });
    expect(screen.getByText(/cannot be reached right now/)).toBeTruthy();
  });

  it("not covered (Poland, France): link-out only, never a level", () => {
    const { container } = renderSection(section("kasprowy-wierch"));
    expect(
      screen.getByText(/We do not display bulletins for this region/),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /LWD Tirol/ }).getAttribute("target"),
    ).toBe("_blank");
    expect(container.textContent).not.toMatch(LEVEL_TEXT);
  });

  it("no service (Bulgaria, Georgia): says nothing official is known", () => {
    renderSection(section("bansko"));
    expect(
      screen.getByText(/No official avalanche service is known for this area/),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: /LWD Tirol/ })).toBeNull();
  });
});

describe("AvalancheCell (compare table)", () => {
  const renderCell = (slug: string, serverNow = DAY) =>
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AvalancheCell
          avalanche={analyse(slug, serverNow)}
          slug={slug}
          renderedAt={serverNow}
        />
      </NextIntlClientProvider>,
    );

  it("current: level badge; stale clock: 'No current data'; link-out and no-service texts", () => {
    vi.useFakeTimers({ now: new Date(DAY), toFake: ["Date"] });
    const current = renderCell("st-anton");
    expect(current.container.textContent).toContain("Considerable");
    cleanup();

    vi.useFakeTimers({
      now: new Date("2026-10-21T10:00:00Z"),
      toFake: ["Date"],
    });
    const stale = renderCell("st-anton");
    expect(stale.container.textContent).not.toContain("Considerable");
    expect(screen.getByText("No current data")).toBeTruthy();
    cleanup();

    expect(renderCell("chamonix").container.textContent).toContain(
      "Not shown here",
    );
    cleanup();
    expect(renderCell("bansko").container.textContent).toContain(
      "No official service known",
    );
  });
});
