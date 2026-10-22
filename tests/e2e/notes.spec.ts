import { expect, test } from "@playwright/test";

test.describe("resort extras", () => {
  test("condition notes: validated, saved on the device, deletable, never sent", async ({
    page,
  }) => {
    const posted: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") posted.push(r.url());
    });
    await page.goto("/en/resorts/verbier");
    const section = page.getByRole("region", { name: "Your condition notes" });
    await expect(section.getByText(/stay on this device only/)).toBeVisible();

    await section.getByRole("button", { name: "Save note" }).click();
    await expect(section.getByRole("alert")).toHaveText(
      "Write a note before saving.",
    );

    await section.getByLabel("Snow").selectOption("wind_packed");
    await section.getByLabel("Notes").fill("Wind crust above 2,500 m.");
    await section
      .getByLabel(/Signs of instability you saw/)
      .fill("Fresh slab release on a north-facing slope.");
    await section.getByRole("button", { name: "Save note" }).click();

    const list = page.getByTestId("condition-notes");
    await expect(list.getByText("Wind crust above 2,500 m.")).toBeVisible();
    await expect(list.getByText(/Wind-packed/)).toBeVisible();

    await page.reload();
    await expect(
      page
        .getByTestId("condition-notes")
        .getByText("Wind crust above 2,500 m."),
    ).toBeVisible();
    // Notes belong to their resort only.
    await page.goto("/en/resorts/zermatt");
    await expect(page.getByTestId("condition-notes")).toHaveCount(0);

    await page.goto("/en/resorts/verbier");
    await page.getByRole("button", { name: "Delete note" }).click();
    await expect(page.getByTestId("condition-notes")).toHaveCount(0);
    expect(posted).toEqual([]);
  });

  test("a future date is refused", async ({ page }) => {
    await page.goto("/en/resorts/verbier");
    const section = page.getByRole("region", { name: "Your condition notes" });
    const future = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await section.getByLabel("Date").fill(future);
    await section.getByLabel("Notes").fill("Planned trip");
    await section.getByRole("button", { name: "Save note" }).click();
    await expect(section.getByRole("alert")).toHaveText(
      "Choose today or an earlier date.",
    );
  });

  test("official webcams are a link-out, not embedded", async ({ page }) => {
    await page.goto("/en/resorts/chamonix");
    const link = page.getByRole("link", { name: /Official webcams/ });
    await expect(link).toHaveAttribute(
      "href",
      "https://www.chamonix.com/webcams",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(page.locator("iframe")).toHaveCount(0);
  });
});
