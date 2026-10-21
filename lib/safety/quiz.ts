export interface QuizQuestion {
  id: string;
  /** Index of the correct option. Texts live in messages/*.json under Quiz.questions.<id>. */
  correct: number;
  optionCount: number;
}

/** 13 questions. Correct answers are spread over the positions on purpose. */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: "q1", correct: 0, optionCount: 4 },
  { id: "q2", correct: 1, optionCount: 4 },
  { id: "q3", correct: 3, optionCount: 4 },
  { id: "q4", correct: 2, optionCount: 4 },
  { id: "q5", correct: 3, optionCount: 4 },
  { id: "q6", correct: 2, optionCount: 4 },
  { id: "q7", correct: 2, optionCount: 4 },
  { id: "q8", correct: 2, optionCount: 4 },
  { id: "q9", correct: 2, optionCount: 4 },
  { id: "q10", correct: 3, optionCount: 4 },
  { id: "q11", correct: 1, optionCount: 4 },
  { id: "q12", correct: 3, optionCount: 4 },
  { id: "q13", correct: 1, optionCount: 4 },
];

/** One entry per question: the chosen option index, or null if the question was skipped. */
export type QuizAnswers = (number | null)[];

export type QuestionResult = "correct" | "incorrect" | "skipped";

export interface QuizScore {
  correct: number;
  total: number;
  /** Whole percent, rounded. */
  percent: number;
  skipped: number;
  results: QuestionResult[];
}

/**
 * Skipped questions, and answers that are not a valid option index, count as wrong.
 * `answers` may be shorter than the question list; missing entries are skipped questions.
 */
export function scoreQuiz(
  answers: QuizAnswers,
  questions: QuizQuestion[] = QUIZ_QUESTIONS,
): QuizScore {
  const results = questions.map((q, i): QuestionResult => {
    const a = answers[i];
    if (a === null || a === undefined) return "skipped";
    if (!Number.isInteger(a) || a < 0 || a >= q.optionCount) return "incorrect";
    return a === q.correct ? "correct" : "incorrect";
  });
  const correct = results.filter((r) => r === "correct").length;
  const total = questions.length;
  return {
    correct,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    skipped: results.filter((r) => r === "skipped").length,
    results,
  };
}

export type Verdict = "high" | "mid" | "low";

/** 85% and above is "high", 60% and above is "mid". */
export function verdictFor(percent: number): Verdict {
  if (percent >= 85) return "high";
  if (percent >= 60) return "mid";
  return "low";
}
