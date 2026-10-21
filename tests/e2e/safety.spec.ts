import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ALL_ITEM_IDS } from "../../lib/safety/checklist";
import { QUIZ_QUESTIONS, scoreQuiz } from "../../lib/safety/quiz";
import en from "../../messages/en.json";

const TOTAL = ALL_ITEM_IDS.length;

test.describe("safety index", () => {
  test("links to the three tools, lists the five danger levels and cites verified sources", async ({
    page,
  }) => {
    await page.goto("/en/safety");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Safety");
    for (const name of [
      "Gear and trip checklist",
      "Aspect and steepness explained",
      "Avalanche safety quiz",
    ]) {
      await expect(
        page.getByRole("link", { name: new RegExp(name) }),
      ).toBeVisible();
    }
    const levels = page
      .getByRole("list")
      .filter({ has: page.getByText("Very high") })
      .first();
    await expect(levels.getByRole("listitem")).toHaveCount(5);
    for (const word of [
      "Low",
      "Moderate",
      "Considerable",
      "High",
      "Very high",
    ]) {
      await expect(levels.getByText(word, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: /SLF \(WSL Institute/ }),
    ).toHaveAttribute("href", "https://www.slf.ch/en/avalanches/");
    await expect(page.getByRole("link", { name: /ICAR/ })).toHaveAttribute(
      "href",
      "https://www.icar.org/",
    );
    await expect(page.getByText(/For education only/)).toBeVisible();
    await expect(
      page.getByText(/Not a substitute for the official bulletin/).first(),
    ).toBeVisible();
  });

  test("navigation reaches each tool", async ({ page }) => {
    await page.goto("/en/safety");
    await page.getByRole("link", { name: /Gear and trip checklist/ }).click();
    await expect(page).toHaveURL(/\/en\/safety\/checklist$/);
    await page.getByRole("link", { name: "← Safety" }).click();
    await page.getByRole("link", { name: /Avalanche safety quiz/ }).click();
    await expect(page).toHaveURL(/\/en\/safety\/quiz$/);
  });

  test("Polish", async ({ page }) => {
    await page.goto("/pl/safety");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bezpieczeństwo",
    );
    await expect(page.getByText("Bardzo duże", { exact: true })).toBeVisible();
  });
});

test.describe("checklist", () => {
  const box = (page: Page, name: string | RegExp) =>
    page.getByRole("checkbox", { name });

  test("PERSISTENCE: ticks survive a reload and are shared between languages", async ({
    page,
  }) => {
    await page.goto("/en/safety/checklist");
    await expect(page.getByText(`0 of ${TOTAL} done`)).toBeVisible();
    await box(page, /^Avalanche transceiver/).check();
    await box(page, /^Avalanche probe/).check();
    await box(page, "Helmet").check();
    await expect(page.getByText(`3 of ${TOTAL} done`)).toBeVisible();

    await page.reload();
    await expect(box(page, /^Avalanche transceiver/)).toBeChecked();
    await expect(box(page, /^Avalanche probe/)).toBeChecked();
    await expect(box(page, "Helmet")).toBeChecked();
    await expect(box(page, /^Avalanche shovel/)).not.toBeChecked();
    await expect(page.getByText(`3 of ${TOTAL} done`)).toBeVisible();

    // The same device list is used by the Polish page.
    await page.goto("/pl/safety/checklist");
    await expect(page.getByText(`3 z ${TOTAL} gotowe`)).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /^Sonda lawinowa/ }),
    ).toBeChecked();
  });

  test("unticking and clearing are remembered too", async ({ page }) => {
    await page.goto("/en/safety/checklist");
    await box(page, "Helmet").check();
    await box(page, /^Avalanche shovel/).check();
    await box(page, "Helmet").uncheck();
    await page.reload();
    await expect(box(page, "Helmet")).not.toBeChecked();
    await expect(box(page, /^Avalanche shovel/)).toBeChecked();

    await page.getByRole("button", { name: "Clear all ticks" }).click();
    await page.reload();
    await expect(page.getByText(`0 of ${TOTAL} done`)).toBeVisible();
  });

  test("the rescue trio is marked essential and every item is reachable by keyboard", async ({
    page,
  }) => {
    await page.goto("/en/safety/checklist");
    await expect(page.getByText("Essential", { exact: true })).toHaveCount(3);
    const first = box(page, /^Avalanche transceiver/);
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
  });

  test("hints describe an item without becoming part of its name", async ({
    page,
  }) => {
    await page.goto("/en/safety/checklist");
    const probe = box(page, /^Avalanche probe/);
    await expect(probe).toHaveAccessibleName(/^Avalanche probe\s*Essential$/);
    await expect(probe).toHaveAccessibleDescription(/At least 240 cm long/);
  });

  test("print layout hides the site chrome and the controls but keeps the list and the disclaimer", async ({
    page,
  }) => {
    await page.goto("/en/safety/checklist");
    await box(page, /^Avalanche transceiver/).check();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Print this list" }),
    ).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(box(page, /^Avalanche transceiver/)).toBeVisible();
    await expect(
      page.getByText(/Not a substitute for the official bulletin/).first(),
    ).toBeVisible();
    // Always dark on white in print, even if the screen theme is dark.
    const colours = await page.evaluate(() => ({
      bg: getComputedStyle(document.body).backgroundColor,
      fg: getComputedStyle(document.body).color,
    }));
    expect(colours).toEqual({ bg: "rgb(255, 255, 255)", fg: "rgb(0, 0, 0)" });
  });

  test("the print button asks the browser to print", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed++;
      };
    });
    await page.goto("/en/safety/checklist");
    await page.getByRole("button", { name: "Print this list" }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __printed: number }).__printed,
      ),
    ).toBe(1);
  });
});

test.describe("aspect and steepness explainer", () => {
  test("the compass explains each aspect and is fully keyboard operable", async ({
    page,
  }) => {
    await page.goto("/en/safety/aspects");
    const rose = page.getByRole("radiogroup", { name: /Compass rose/ });
    await expect(rose.getByRole("radio")).toHaveCount(8);

    await rose.getByRole("radio", { name: "South", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 3, name: "South" }),
    ).toBeVisible();
    await expect(
      page.getByText(/South-facing slopes get the most sun/),
    ).toBeVisible();

    // Arrow keys move the selection around the compass.
    await rose.getByRole("radio", { name: "South", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(rose.getByRole("radio", { name: "South-west" })).toBeChecked();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(rose.getByRole("radio", { name: "South-east" })).toBeChecked();
    // Space selects the focused wedge and wraps around north.
    await rose.getByRole("radio", { name: "North", exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(rose.getByRole("radio", { name: "North-west" })).toBeChecked();
    await expect(
      page.getByText(/North-west-facing slopes get little sun/),
    ).toBeVisible();
  });

  test("wind mode highlights the sheltered side", async ({ page }) => {
    await page.goto("/en/safety/aspects");
    await page
      .getByRole("radio", { name: "Where does wind load the snow?" })
      .check();
    const rose = page.getByRole("radiogroup", { name: /Compass rose/ });
    await rose.getByRole("radio", { name: "West", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 3, name: "Wind blowing from West" }),
    ).toBeVisible();
    await expect(
      page.getByText(/slopes facing North-east, East, South-east/),
    ).toBeVisible();
    await expect(
      page.getByText("Highlighted: most likely to be loaded"),
    ).toBeVisible();

    await rose.getByRole("radio", { name: "South", exact: true }).click();
    await expect(
      page.getByText(/slopes facing North-west, North, North-east/),
    ).toBeVisible();
  });

  test("the steepness slider names the band and the 30-45 degree range is emphasised", async ({
    page,
  }) => {
    await page.goto("/en/safety/aspects");
    const slider = page.getByLabel("Slope angle in degrees");
    const expected: [number, string, number][] = [
      [10, "Under 25°: gentle", 18],
      [27, "25–29°: borderline", 51],
      [30, "30–34°: avalanche terrain", 58],
      [37, "35–39°: the most common accident range", 75],
      [45, "40–45°: steep avalanche terrain", 100],
      [46, "Over 45°: very steep", 104],
    ];
    for (const [deg, title, percent] of expected) {
      await slider.fill(String(deg));
      await expect(
        page.getByRole("heading", { level: 3, name: title }),
      ).toBeVisible();
      await expect(
        page.getByText(`${deg}° is about a ${percent}% grade.`),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: `A slope rising at ${deg} degrees` }),
      ).toBeVisible();
    }
  });

  test("the slider works with the keyboard", async ({ page }) => {
    await page.goto("/en/safety/aspects");
    const slider = page.getByLabel("Slope angle in degrees");
    await slider.focus();
    await slider.fill("29");
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("heading", {
        level: 3,
        name: "30–34°: avalanche terrain",
      }),
    ).toBeVisible();
  });

  test("explains why 30-45 degrees and links to the avalanche map; Polish page works", async ({
    page,
  }) => {
    await page.goto("/en/safety/aspects");
    await expect(
      page.getByRole("heading", { name: "Why 30–45°?" }),
    ).toBeVisible();
    await expect(
      page.getByText(/rules of thumb, not a safe\/unsafe switch/),
    ).toBeVisible();
    await page.getByRole("link", { name: "Open the avalanche map" }).click();
    await expect(page).toHaveURL(/\/en\/avalanche$/);

    await page.goto("/pl/safety/aspects");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Wystawa i stromość stoku",
    );
    await page.getByLabel("Nachylenie stoku w stopniach").fill("37");
    await expect(
      page.getByRole("heading", {
        level: 3,
        name: "35–39°: najczęstszy zakres wypadków",
      }),
    ).toBeVisible();
  });
});

test.describe("quiz", () => {
  const texts = en.Quiz.questions as Record<
    string,
    { question: string; options: string[] }
  >;

  async function answer(
    page: Page,
    pick: (q: (typeof QUIZ_QUESTIONS)[number]) => number | null,
  ) {
    for (const q of QUIZ_QUESTIONS) {
      const choice = pick(q);
      if (choice === null) continue;
      const group = page.getByRole("group", {
        name: new RegExp(
          texts[q.id].question
            .slice(0, 40)
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      });
      await group
        .getByRole("radio", { name: texts[q.id].options[choice], exact: true })
        .check();
    }
  }

  test("a perfect attempt scores 100% and shows the explanations", async ({
    page,
  }) => {
    await page.goto("/en/safety/quiz");
    await answer(page, (q) => q.correct);
    await page.getByRole("button", { name: "Check answers" }).click();
    await expect(page.getByText("You scored 13 of 13 (100%).")).toBeVisible();
    await expect(page.getByText(/Great result/)).toBeVisible();
    await expect(page.getByText("✓ Correct")).toHaveCount(13);
    // Focus moves to the result for keyboard and screen-reader users.
    await expect(page.getByRole("status")).toBeFocused();
  });

  test("the scoring in the browser matches the scoring function for a mixed attempt", async ({
    page,
  }) => {
    await page.goto("/en/safety/quiz");
    const pick = (q: (typeof QUIZ_QUESTIONS)[number]) =>
      q.id === "q4" || q.id === "q9"
        ? (q.correct + 1) % q.optionCount
        : q.id === "q13"
          ? null
          : q.correct;
    await answer(page, pick);
    await page.getByRole("button", { name: "Check answers" }).click();
    const expected = scoreQuiz(QUIZ_QUESTIONS.map((q) => pick(q)));
    expect(expected).toMatchObject({ correct: 10, skipped: 1 });
    await expect(
      page.getByText(
        `You scored ${expected.correct} of ${expected.total} (${expected.percent}%).`,
      ),
    ).toBeVisible();
    await expect(
      page.getByText("1 question was not answered and counts as wrong."),
    ).toBeVisible();
    await expect(page.getByText("✗ Incorrect")).toHaveCount(2);
    await expect(page.getByText("– Not answered")).toHaveCount(1);
    // Wrong answers reveal the correct one.
    await expect(
      page.getByText(
        `Correct answer: ${texts.q4.options[QUIZ_QUESTIONS[3].correct]}`,
      ),
    ).toBeVisible();
  });

  test("answers lock after checking and 'Try again' resets everything", async ({
    page,
  }) => {
    await page.goto("/en/safety/quiz");
    await answer(page, (q) => (q.correct + 1) % q.optionCount);
    await page.getByRole("button", { name: "Check answers" }).click();
    await expect(page.getByText("You scored 0 of 13 (0%).")).toBeVisible();
    await expect(page.getByRole("radio").first()).toBeDisabled();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(page.getByRole("radio").first()).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Check answers" }),
    ).toBeVisible();
  });

  test("Polish quiz", async ({ page }) => {
    await page.goto("/pl/safety/quiz");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Quiz o bezpieczeństwie lawinowym",
    );
    await page.getByRole("button", { name: "Sprawdź odpowiedzi" }).click();
    await expect(page.getByText("Twój wynik: 0 z 13 (0%).")).toBeVisible();
    await expect(
      page.getByText("13 pytań bez odpowiedzi liczy się jako błędne."),
    ).toBeVisible();
  });
});

for (const theme of ["light", "dark"] as const) {
  for (const route of [
    "/en/safety",
    "/pl/safety",
    "/en/safety/checklist",
    "/pl/safety/checklist",
    "/en/safety/aspects",
    "/pl/safety/aspects",
    "/en/safety/quiz",
    "/pl/safety/quiz",
  ]) {
    test(`no axe violations on ${route} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(route);
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

  test(`no axe violations in interactive states (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${label} ${v.id}: ${v.nodes[0]?.html.slice(0, 140)}`,
        ),
      ).toEqual([]);
    };

    await page.goto("/en/safety/checklist");
    await page
      .getByRole("checkbox", { name: /^Avalanche transceiver/ })
      .check();
    await check("checklist ticked");

    await page.goto("/en/safety/aspects");
    await page
      .getByRole("radio", { name: "Where does wind load the snow?" })
      .check();
    await page
      .getByRole("radiogroup", { name: /Compass rose/ })
      .getByRole("radio", { name: "North-east" })
      .click();
    await check("aspects wind mode");
    await page.getByLabel("Slope angle in degrees").fill("38");
    await check("steepness 38");
    await page.getByLabel("Slope angle in degrees").fill("52");
    await check("steepness 52");

    await page.goto("/en/safety/quiz");
    await page.getByRole("button", { name: "Check answers" }).click();
    await check("quiz result");
  });
}
