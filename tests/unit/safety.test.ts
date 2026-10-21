import { describe, expect, it } from "vitest";
import {
  ALL_ITEM_IDS,
  CHECKLIST_GROUPS,
  parseChecked,
  serialiseChecked,
  toggled,
} from "@/lib/safety/checklist";
import {
  QUIZ_QUESTIONS,
  scoreQuiz,
  verdictFor,
  type QuizAnswers,
} from "@/lib/safety/quiz";
import {
  ASPECT_ORDER,
  isCriticalRange,
  leeAspects,
  oppositeAspect,
  slopePercent,
  steepnessBand,
} from "@/lib/safety/terrain";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";

const MESSAGES = { en, pl } as const;

describe("quiz scoring", () => {
  const allCorrect = (): QuizAnswers => QUIZ_QUESTIONS.map((q) => q.correct);
  const wrong = (q: (typeof QUIZ_QUESTIONS)[number]) =>
    (q.correct + 1) % q.optionCount;

  it("scores a perfect attempt as 100%", () => {
    const s = scoreQuiz(allCorrect());
    expect(s).toMatchObject({
      correct: 13,
      total: 13,
      percent: 100,
      skipped: 0,
    });
    expect(s.results.every((r) => r === "correct")).toBe(true);
  });

  it("scores all-wrong as 0% and marks them incorrect, not skipped", () => {
    const s = scoreQuiz(QUIZ_QUESTIONS.map(wrong));
    expect(s).toMatchObject({ correct: 0, percent: 0, skipped: 0 });
    expect(s.results.every((r) => r === "incorrect")).toBe(true);
  });

  it("counts unanswered questions as wrong but reports them as skipped", () => {
    const answers: QuizAnswers = allCorrect();
    answers[0] = null;
    answers[5] = null;
    const s = scoreQuiz(answers);
    expect(s.correct).toBe(11);
    expect(s.skipped).toBe(2);
    expect(s.results[0]).toBe("skipped");
    expect(s.percent).toBe(85); // 11/13 = 84.6 -> 85
  });

  it("treats a missing or short answer list as all skipped", () => {
    expect(scoreQuiz([])).toMatchObject({
      correct: 0,
      skipped: 13,
      percent: 0,
    });
    const partial = scoreQuiz([QUIZ_QUESTIONS[0].correct]);
    expect(partial).toMatchObject({ correct: 1, skipped: 12 });
  });

  it("treats an out-of-range or non-integer answer as incorrect, never as correct", () => {
    const answers: QuizAnswers = allCorrect();
    answers[0] = 99;
    answers[1] = -1;
    answers[2] = 1.5;
    const s = scoreQuiz(answers);
    expect(s.results.slice(0, 3)).toEqual([
      "incorrect",
      "incorrect",
      "incorrect",
    ]);
    expect(s.correct).toBe(10);
  });

  it("handles an empty question list", () => {
    expect(scoreQuiz([], [])).toMatchObject({
      total: 0,
      percent: 0,
      correct: 0,
    });
  });

  it("maps scores to verdicts at the documented boundaries", () => {
    expect(verdictFor(100)).toBe("high");
    expect(verdictFor(85)).toBe("high");
    expect(verdictFor(84)).toBe("mid");
    expect(verdictFor(60)).toBe("mid");
    expect(verdictFor(59)).toBe("low");
    expect(verdictFor(0)).toBe("low");
  });
});

describe("quiz content", () => {
  it("has 10-15 questions with unique ids and valid correct indices", () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(10);
    expect(QUIZ_QUESTIONS.length).toBeLessThanOrEqual(15);
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.id)).size).toBe(
      QUIZ_QUESTIONS.length,
    );
    for (const q of QUIZ_QUESTIONS) {
      expect(q.optionCount, q.id).toBeGreaterThanOrEqual(3);
      expect(q.correct, q.id).toBeGreaterThanOrEqual(0);
      expect(q.correct, q.id).toBeLessThan(q.optionCount);
    }
  });

  it("does not always put the right answer in the same position", () => {
    const positions = new Set(QUIZ_QUESTIONS.map((q) => q.correct));
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  for (const locale of ["en", "pl"] as const) {
    it(`has complete ${locale} text for every question, with matching option counts`, () => {
      const texts = MESSAGES[locale].Quiz.questions as Record<
        string,
        { question: string; options: string[]; explanation: string }
      >;
      expect(Object.keys(texts).sort()).toEqual(
        QUIZ_QUESTIONS.map((q) => q.id).sort(),
      );
      for (const q of QUIZ_QUESTIONS) {
        const t = texts[q.id];
        expect(t.question.length, q.id).toBeGreaterThan(10);
        expect(t.explanation.length, q.id).toBeGreaterThan(20);
        expect(t.options, q.id).toHaveLength(q.optionCount);
        expect(new Set(t.options).size, `${q.id} has duplicate options`).toBe(
          t.options.length,
        );
        for (const o of t.options)
          expect(o.trim().length, q.id).toBeGreaterThan(0);
      }
    });
  }

  it("keeps the correct option in the same position in English and Polish", () => {
    // Spot-check anchors that must agree across languages: the essential kit and the 30-45 degree range.
    const q1 = QUIZ_QUESTIONS.find((q) => q.id === "q1")!;
    expect(en.Quiz.questions.q1.options[q1.correct]).toMatch(/ransceiver/);
    expect(pl.Quiz.questions.q1.options[q1.correct]).toMatch(/Detektor/);
    const q3 = QUIZ_QUESTIONS.find((q) => q.id === "q3")!;
    expect(en.Quiz.questions.q3.options[q3.correct]).toMatch(/30–45/);
    expect(pl.Quiz.questions.q3.options[q3.correct]).toMatch(/30–45/);
    const q4 = QUIZ_QUESTIONS.find((q) => q.id === "q4")!;
    expect(en.Quiz.questions.q4.options[q4.correct]).toMatch(/East/);
    expect(pl.Quiz.questions.q4.options[q4.correct]).toMatch(/wschodniej/);
    const q7 = QUIZ_QUESTIONS.find((q) => q.id === "q7")!;
    expect(en.Quiz.questions.q7.options[q7.correct]).toMatch(/15 minutes/);
    expect(pl.Quiz.questions.q7.options[q7.correct]).toMatch(/15 minutach/);
    const q8 = QUIZ_QUESTIONS.find((q) => q.id === "q8")!;
    expect(en.Quiz.questions.q8.options[q8.correct]).toMatch(
      /official bulletin/,
    );
    expect(pl.Quiz.questions.q8.options[q8.correct]).toMatch(
      /oficjalny komunikat/,
    );
  });
});

describe("checklist data", () => {
  it("has unique item ids across groups", () => {
    expect(new Set(ALL_ITEM_IDS).size).toBe(ALL_ITEM_IDS.length);
    expect(ALL_ITEM_IDS.length).toBeGreaterThanOrEqual(15);
  });

  it("marks exactly the transceiver, probe and shovel as essential", () => {
    const essential = CHECKLIST_GROUPS.flatMap((g) => g.items).filter(
      (i) => i.essential,
    );
    expect(essential.map((i) => i.id).sort()).toEqual([
      "probe",
      "shovel",
      "transceiver",
    ]);
  });

  for (const locale of ["en", "pl"] as const) {
    it(`has a ${locale} label for every item and group`, () => {
      const m = MESSAGES[locale].Checklist;
      const items = m.items as Record<string, { label: string; hint: string }>;
      for (const id of ALL_ITEM_IDS)
        expect(items[id]?.label.length, id).toBeGreaterThan(3);
      for (const g of CHECKLIST_GROUPS) {
        expect((m.groups as Record<string, string>)[g.id], g.id).toBeTruthy();
      }
      expect(Object.keys(items).sort()).toEqual([...ALL_ITEM_IDS].sort());
    });
  }
});

describe("checklist storage", () => {
  it("round-trips a selection in a stable order", () => {
    const raw = serialiseChecked(
      new Set(["shovel", "transceiver", "bulletin"]),
    );
    expect(raw).toBe(JSON.stringify(["transceiver", "shovel", "bulletin"]));
    expect([...parseChecked(raw)].sort()).toEqual([
      "bulletin",
      "shovel",
      "transceiver",
    ]);
  });

  it("treats missing, empty and corrupt values as an empty selection", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "not json",
      "{",
      "null",
      "42",
      '{"a":1}',
      '"transceiver"',
    ]) {
      expect(parseChecked(raw).size, String(raw)).toBe(0);
    }
  });

  it("drops unknown ids and non-string entries instead of trusting them", () => {
    const parsed = parseChecked(
      JSON.stringify([
        "transceiver",
        "removed-item",
        5,
        null,
        { id: "probe" },
        "probe",
      ]),
    );
    expect([...parsed].sort()).toEqual(["probe", "transceiver"]);
  });

  it("toggles without mutating the input", () => {
    const start = new Set(["probe"]);
    const on = toggled(start, "shovel", true);
    const off = toggled(on, "probe", false);
    expect([...start]).toEqual(["probe"]);
    expect([...on].sort()).toEqual(["probe", "shovel"]);
    expect([...off]).toEqual(["shovel"]);
  });
});

describe("aspects and wind", () => {
  it("lists the eight aspects clockwise from north", () => {
    expect([...ASPECT_ORDER]).toEqual([
      "N",
      "NE",
      "E",
      "SE",
      "S",
      "SW",
      "W",
      "NW",
    ]);
  });

  it("finds the opposite aspect", () => {
    expect(oppositeAspect("N")).toBe("S");
    expect(oppositeAspect("NE")).toBe("SW");
    expect(oppositeAspect("W")).toBe("E");
    for (const a of ASPECT_ORDER)
      expect(oppositeAspect(oppositeAspect(a))).toBe(a);
  });

  it("puts the lee side opposite the wind, centred on it", () => {
    expect(leeAspects("W")).toEqual(["NE", "E", "SE"]);
    expect(leeAspects("E")).toEqual(["SW", "W", "NW"]);
    expect(leeAspects("N")).toEqual(["SE", "S", "SW"]);
    expect(leeAspects("S")).toEqual(["NW", "N", "NE"]); // wraps around north
    expect(leeAspects("NE")).toEqual(["S", "SW", "W"]);
    expect(leeAspects("NW")).toEqual(["E", "SE", "S"]);
  });

  it("never includes the windward side and always returns three aspects", () => {
    for (const wind of ASPECT_ORDER) {
      const lee = leeAspects(wind);
      expect(lee).toHaveLength(3);
      expect(lee).not.toContain(wind);
      expect(lee).toContain(oppositeAspect(wind));
    }
  });
});

describe("steepness", () => {
  it("assigns bands at the documented boundaries (whole degrees)", () => {
    const cases: [number, string][] = [
      [0, "flat"],
      [24, "flat"],
      [24.4, "flat"],
      [25, "borderline"],
      [29, "borderline"],
      [30, "terrain"],
      [34, "terrain"],
      [35, "peak"],
      [39, "peak"],
      [40, "steep"],
      [45, "steep"],
      [46, "verysteep"],
      [60, "verysteep"],
      [90, "verysteep"],
    ];
    for (const [deg, band] of cases)
      expect(steepnessBand(deg), `${deg}°`).toBe(band);
  });

  it("clamps negative angles to flat", () => {
    expect(steepnessBand(-5)).toBe("flat");
  });

  it("marks 30-45 degrees as the critical range, inclusive", () => {
    expect(isCriticalRange(29)).toBe(false);
    expect(isCriticalRange(30)).toBe(true);
    expect(isCriticalRange(45)).toBe(true);
    expect(isCriticalRange(46)).toBe(false);
  });

  it("agrees with the bands: every critical angle is terrain, peak or steep", () => {
    for (let d = 0; d <= 90; d++) {
      const inBands = ["terrain", "peak", "steep"].includes(steepnessBand(d));
      expect(inBands, `${d}°`).toBe(isCriticalRange(d));
    }
  });

  it("converts degrees to percent grade", () => {
    expect(slopePercent(0)).toBe(0);
    expect(slopePercent(45)).toBe(100);
    expect(slopePercent(30)).toBe(58);
    expect(slopePercent(35)).toBe(70);
    expect(slopePercent(40)).toBe(84);
  });

  it("has English and Polish text for every band", () => {
    for (const locale of ["en", "pl"] as const) {
      const bands = MESSAGES[locale].Aspects.bands as Record<
        string,
        { title: string; body: string }
      >;
      for (const id of [
        "flat",
        "borderline",
        "terrain",
        "peak",
        "steep",
        "verysteep",
      ]) {
        expect(bands[id]?.title.length, `${locale} ${id}`).toBeGreaterThan(3);
        expect(bands[id]?.body.length, `${locale} ${id}`).toBeGreaterThan(20);
      }
    }
  });

  it("has English and Polish text for every aspect and direction", () => {
    for (const locale of ["en", "pl"] as const) {
      const m = MESSAGES[locale].Aspects;
      for (const a of ASPECT_ORDER) {
        expect(
          (m.aspectInfo as Record<string, string>)[a]?.length,
          `${locale} info ${a}`,
        ).toBeGreaterThan(20);
        expect(
          (m.directions as Record<string, string>)[a]?.length,
          `${locale} name ${a}`,
        ).toBeGreaterThan(2);
      }
    }
  });
});
