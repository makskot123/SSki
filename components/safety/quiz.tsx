"use client";

import { useMessages, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  QUIZ_QUESTIONS,
  scoreQuiz,
  verdictFor,
  type QuizAnswers,
} from "@/lib/safety/quiz";

const blank = (): QuizAnswers => QUIZ_QUESTIONS.map(() => null);

export function Quiz() {
  const t = useTranslations("Quiz");
  const texts = useMessages().Quiz.questions;
  const [answers, setAnswers] = useState<QuizAnswers>(blank);
  const [submitted, setSubmitted] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLFormElement>(null);

  const score = scoreQuiz(answers);

  function check(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    // Move focus to the result so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => summary.current?.focus());
  }

  function retry() {
    setAnswers(blank());
    setSubmitted(false);
    requestAnimationFrame(() => top.current?.focus());
  }

  return (
    <form
      ref={top}
      tabIndex={-1}
      onSubmit={check}
      className="space-y-6 outline-none"
    >
      {submitted && (
        <div
          ref={summary}
          tabIndex={-1}
          role="status"
          className="space-y-2 rounded-lg border-2 border-accent bg-surface p-4 outline-none"
        >
          <p className="text-xl font-bold">
            {t("scoreLine", {
              correct: score.correct,
              total: score.total,
              percent: score.percent,
            })}
          </p>
          {score.skipped > 0 && (
            <p>{t("unanswered", { count: score.skipped })}</p>
          )}
          <p>{t(`verdict.${verdictFor(score.percent)}`)}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:opacity-90"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {QUIZ_QUESTIONS.map((q, i) => {
        const text = texts[q.id as keyof typeof texts];
        const result = score.results[i];
        return (
          <fieldset
            key={q.id}
            disabled={submitted}
            className="space-y-2 card p-4"
          >
            <legend className="px-1 font-semibold">
              <span className="block text-xs font-normal text-muted">
                {t("questionLabel", { n: i + 1, total: QUIZ_QUESTIONS.length })}
              </span>
              {text.question}
            </legend>
            <ul className="space-y-1.5">
              {text.options.map((option, j) => (
                <li key={j}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 has-[:checked]:bg-bg">
                    <input
                      type="radio"
                      name={`quiz-${q.id}`}
                      checked={answers[i] === j}
                      onChange={() =>
                        setAnswers((a) => a.map((v, k) => (k === i ? j : v)))
                      }
                      className="mt-1 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span>{option}</span>
                  </label>
                </li>
              ))}
            </ul>

            {submitted && (
              <div className="space-y-1 border-t border-border pt-2 text-sm">
                <p className="font-semibold">
                  {result === "correct"
                    ? `✓ ${t("correct")}`
                    : result === "skipped"
                      ? `– ${t("skipped")}`
                      : `✗ ${t("incorrect")}`}
                </p>
                {result !== "correct" && (
                  <p>
                    {t("correctAnswer", { answer: text.options[q.correct] })}
                  </p>
                )}
                <p className="text-muted">{text.explanation}</p>
              </div>
            )}
          </fieldset>
        );
      })}

      {!submitted && (
        <button
          type="submit"
          className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-fg"
        >
          {t("check")}
        </button>
      )}
    </form>
  );
}
