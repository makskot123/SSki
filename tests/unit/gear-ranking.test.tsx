// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { GearRanking } from "@/components/gear/gear-ranking";
import type { GearProduct } from "@/lib/schemas/gear";
import en from "@/messages/en.json";

// Fictional fixtures: the UI must work once verified products are added to data/gear.json.
const probe = (
  id: string,
  priceEUR: number,
  lengthCm: number,
  weightG: number,
  priceCheckedAt = "2026-09-01",
): GearProduct => ({
  id,
  brand: "Test",
  model: id,
  priceEUR,
  priceCheckedAt,
  sourceUrl: `https://example.com/${id}`,
  category: "probe",
  specs: { lengthCm, quickLock: true, material: "aluminium", weightG },
});

const PRODUCTS: GearProduct[] = [
  // Longest: best performance. Lightest: wins the "Lightest" preset. Old price: mid length, heaviest.
  probe("long-heavy", 120, 320, 300),
  probe("short-light", 60, 240, 220),
  probe("old-price", 80, 280, 400, "2024-01-01"),
  { ...probe("too-short", 20, 200, 150), id: "too-short" },
];

const NOW = "2026-10-22T12:00:00Z";
const renderRanking = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <GearRanking category="probe" products={PRODUCTS} now={NOW} />
    </NextIntlClientProvider>,
  );

const order = () =>
  within(screen.getAllByRole("list")[0])
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent?.replace(/^#\d+Rank \d+/, "").trim());

afterEach(cleanup);

describe("GearRanking", () => {
  it("ranks only products meeting the minimums, and switches with presets", () => {
    renderRanking();
    expect(order()).not.toContain("Test too-short");
    expect(order()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Best performance" }));
    expect(order()[0]).toBe("Test long-heavy");
    fireEvent.click(screen.getByRole("button", { name: "Lightest" }));
    expect(order()[0]).toBe("Test short-light");
    expect(
      screen
        .getByRole("button", { name: "Lightest" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("the slider switches to a custom blend", () => {
    renderRanking();
    fireEvent.change(screen.getByLabelText("Performance ↔ price"), {
      target: { value: "100" },
    });
    expect(order()[0]).toBe("Test long-heavy");
    expect(
      screen.getByText("100% performance, 0% value for money"),
    ).toBeTruthy();
    for (const b of screen.getAllByRole("button")) {
      expect(b.getAttribute("aria-pressed")).not.toBe("true");
    }
  });

  it("products below the minimum appear only on request, with the reason", () => {
    renderRanking();
    expect(screen.queryByText(/Misses:/)).toBeNull();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Show products below the minimum standard",
      }),
    );
    expect(screen.getByText("Misses: At least 240 cm long")).toBeTruthy();
  });

  it("flags prices checked more than 12 months ago and links the manufacturer page", () => {
    renderRanking();
    expect(screen.getAllByText(/checked more than 12 months ago/)).toHaveLength(
      1,
    );
    const links = screen.getAllByRole("link", { name: /Manufacturer specs/ });
    expect(links[0].getAttribute("rel")).toContain("noopener");
  });

  it("says so when no products are listed", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <GearRanking category="probe" products={[]} now={NOW} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/No products are listed yet/)).toBeTruthy();
  });
});
