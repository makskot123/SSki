// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Quiz } from "@/components/safety/quiz";
import { ALL_ITEM_IDS, CHECKLIST_STORAGE_KEY } from "@/lib/safety/checklist";
import { QUIZ_QUESTIONS } from "@/lib/safety/quiz";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";

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
}));

const TOTAL = ALL_ITEM_IDS.length;

const wrap = (node: React.ReactNode, locale: "en" | "pl" = "en") => (
  <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : pl}>
    {node}
  </NextIntlClientProvider>
);

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A fresh copy of the checklist module, as after a page reload (module state is gone, storage remains). */
async function freshChecklist() {
  vi.resetModules();
  return (await import("@/components/safety/checklist")).Checklist;
}

const box = (name: string | RegExp) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;

describe("Checklist", () => {
  it("links the five gear items to their gear-guide category, outside the tick box label", async () => {
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    const links = screen.getAllByRole("link", { name: /^What to look for:/ });
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/safety/gear/transceiver",
      "/safety/gear/probe",
      "/safety/gear/shovel",
      "/safety/gear/airbag",
      "/safety/gear/helmet",
    ]);
    for (const a of links) expect(a.closest("label")).toBeNull();
  });

  it("starts empty and counts ticks", async () => {
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    expect(screen.getByText(`0 of ${TOTAL} done`)).toBeTruthy();
    fireEvent.click(box(/Avalanche transceiver/));
    fireEvent.click(box(/^Avalanche probe/));
    expect(box(/Avalanche transceiver/).checked).toBe(true);
    expect(screen.getByText(`2 of ${TOTAL} done`)).toBeTruthy();
  });

  it("PERSISTENCE: ticks survive a reload", async () => {
    let Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    fireEvent.click(box(/Avalanche transceiver/));
    fireEvent.click(box(/^Avalanche shovel/));
    expect(
      JSON.parse(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)!),
    ).toEqual(["transceiver", "shovel"]);

    // "Reload": unmount, throw away the module state, mount again. Only localStorage is left.
    cleanup();
    Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    expect(box(/Avalanche transceiver/).checked).toBe(true);
    expect(box(/^Avalanche shovel/).checked).toBe(true);
    expect(box(/^Avalanche probe/).checked).toBe(false);
    expect(screen.getByText(`2 of ${TOTAL} done`)).toBeTruthy();
  });

  it("untick is persisted too, and 'Clear all ticks' empties storage", async () => {
    window.localStorage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify(["probe", "helmet"]),
    );
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    expect(screen.getByText(`2 of ${TOTAL} done`)).toBeTruthy();

    fireEvent.click(box("Helmet"));
    expect(
      JSON.parse(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)!),
    ).toEqual(["probe"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear all ticks" }));
    expect(
      JSON.parse(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)!),
    ).toEqual([]);
    expect(screen.getByText(`0 of ${TOTAL} done`)).toBeTruthy();
  });

  it("ignores corrupt or outdated stored data instead of breaking", async () => {
    for (const bad of [
      "not json",
      '{"a":1}',
      JSON.stringify(["gone-item", 7, null]),
    ]) {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, bad);
      const Checklist = await freshChecklist();
      const { unmount } = render(wrap(<Checklist />));
      expect(screen.getByText(`0 of ${TOTAL} done`), bad).toBeTruthy();
      unmount();
    }
  });

  it("keeps working for the visit when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    fireEvent.click(box(/^Avalanche probe/));
    expect(box(/^Avalanche probe/).checked).toBe(true);
    expect(screen.getByText(`1 of ${TOTAL} done`)).toBeTruthy();
  });

  it("keeps working when reading storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    expect(screen.getByText(`0 of ${TOTAL} done`)).toBeTruthy();
    fireEvent.click(box("Helmet"));
    expect(box("Helmet").checked).toBe(true);
  });

  it("follows changes made in another tab", async () => {
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    window.localStorage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify(["probe"]),
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: CHECKLIST_STORAGE_KEY }),
      );
    });
    expect(box(/^Avalanche probe/).checked).toBe(true);
  });

  it("tags exactly the rescue trio as essential and prints on request", async () => {
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />));
    expect(screen.getAllByText("Essential")).toHaveLength(3);
    const print = vi.fn();
    vi.stubGlobal("print", print);
    fireEvent.click(screen.getByRole("button", { name: "Print this list" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("renders in Polish with Polish labels", async () => {
    const Checklist = await freshChecklist();
    render(wrap(<Checklist />, "pl"));
    expect(screen.getByText(`0 z ${TOTAL} gotowe`)).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: /Sonda lawinowa/ }),
    ).toBeTruthy();
  });
});

/** Radios of one question, found by the shared name. */
const radios = (container: HTMLElement, id: string) => [
  ...container.querySelectorAll<HTMLInputElement>(`input[name="quiz-${id}"]`),
];

function answerAll(
  container: HTMLElement,
  pick: (q: (typeof QUIZ_QUESTIONS)[number]) => number | null,
) {
  for (const q of QUIZ_QUESTIONS) {
    const choice = pick(q);
    if (choice !== null) fireEvent.click(radios(container, q.id)[choice]);
  }
}

const renderQuiz = (locale: "en" | "pl" = "en") =>
  render(wrap(<Quiz />, locale));

describe("Quiz", () => {
  it("shows 13 questions with four options each and no score before checking", () => {
    const { container } = renderQuiz();
    expect(container.querySelectorAll("fieldset")).toHaveLength(
      QUIZ_QUESTIONS.length,
    );
    for (const q of QUIZ_QUESTIONS)
      expect(radios(container, q.id)).toHaveLength(q.optionCount);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Check answers" })).toBeTruthy();
  });

  it("scores a perfect attempt and shows the high verdict", () => {
    const { container } = renderQuiz();
    answerAll(container, (q) => q.correct);
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText("You scored 13 of 13 (100%).")).toBeTruthy();
    expect(screen.getByText(/Great result/)).toBeTruthy();
    expect(screen.getAllByText("✓ Correct")).toHaveLength(13);
    expect(screen.queryByText(/✗ Incorrect/)).toBeNull();
  });

  it("scores all-wrong as 0% with the correct answers and explanations revealed", () => {
    const { container } = renderQuiz();
    answerAll(container, (q) => (q.correct + 1) % q.optionCount);
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText("You scored 0 of 13 (0%).")).toBeTruthy();
    expect(screen.getByText(/There is plenty to learn/)).toBeTruthy();
    expect(screen.getAllByText("✗ Incorrect")).toHaveLength(13);
    expect(screen.getAllByText(/^Correct answer: /)).toHaveLength(13);
    // Reveals the right answer text for question 1.
    expect(
      screen.getByText("Correct answer: Transceiver, probe and shovel"),
    ).toBeTruthy();
  });

  it("counts skipped questions as wrong and says so", () => {
    const { container } = renderQuiz();
    answerAll(container, (q) =>
      q.id === "q1" || q.id === "q2" ? null : q.correct,
    );
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText("You scored 11 of 13 (85%).")).toBeTruthy();
    expect(
      screen.getByText("2 questions were not answered and count as wrong."),
    ).toBeTruthy();
    expect(screen.getAllByText("– Not answered")).toHaveLength(2);
  });

  it("submitting with nothing answered is allowed and scores 0", () => {
    renderQuiz();
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(screen.getByText("You scored 0 of 13 (0%).")).toBeTruthy();
    expect(
      screen.getByText("13 questions were not answered and count as wrong."),
    ).toBeTruthy();
  });

  it("locks the answers after checking and 'Try again' starts fresh", () => {
    const { container } = renderQuiz();
    answerAll(container, (q) => q.correct);
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    // Inputs are disabled through their <fieldset> (the cascade), not their own property.
    const fieldsets = () => [...container.querySelectorAll("fieldset")];
    expect(fieldsets().every((f) => f.disabled)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByRole("status")).toBeNull();
    for (const q of QUIZ_QUESTIONS) {
      expect(
        radios(container, q.id).every((r) => !r.checked),
        q.id,
      ).toBe(true);
    }
    expect(fieldsets().every((f) => !f.disabled)).toBe(true);
    expect(screen.getByRole("button", { name: "Check answers" })).toBeTruthy();
  });

  it("lets you change an answer before checking (one choice per question)", () => {
    const { container } = renderQuiz();
    const [a, b] = radios(container, "q3");
    fireEvent.click(a);
    fireEvent.click(b);
    expect(a.checked).toBe(false);
    expect(b.checked).toBe(true);
  });

  it("uses a localised pluralised message in Polish and Polish question text", () => {
    const { container } = renderQuiz("pl");
    answerAll(container, (q) => (q.id === "q1" ? null : q.correct));
    fireEvent.click(screen.getByRole("button", { name: "Sprawdź odpowiedzi" }));
    expect(screen.getByText("Twój wynik: 12 z 13 (92%).")).toBeTruthy();
    expect(
      screen.getByText("1 pytanie bez odpowiedzi liczy się jako błędne."),
    ).toBeTruthy();
    expect(
      screen.getByText(/Jakie trzy elementy tworzą podstawowy zestaw/),
    ).toBeTruthy();
  });

  it("every question is exposed as a labelled group of radios", () => {
    const { container } = renderQuiz();
    const first = container.querySelector("fieldset")!;
    expect(within(first).getAllByRole("radio")).toHaveLength(4);
    expect(first.querySelector("legend")?.textContent).toMatch(
      /Question 1 of 13/,
    );
  });
});
