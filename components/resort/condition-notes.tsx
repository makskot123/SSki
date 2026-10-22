"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { createLocalStore } from "@/components/ui/local-store";
import {
  addNote,
  MAX_NOTE_LENGTH,
  noteInputSchema,
  NOTES_STORAGE_KEY,
  parseNotes,
  removeNote,
  SNOW_QUALITIES,
} from "@/lib/notes";

const store = createLocalStore(NOTES_STORAGE_KEY);

/** The visitor's local calendar date (a note is about the day they skied, in their time zone). */
const today = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * The visitor's own condition notes for a resort. Kept only on this device: never sent, shared or used
 * for any ranking or danger level.
 */
export function ConditionNotes({ slug }: { slug: string }) {
  const t = useTranslations("Notes");
  const format = useFormatter();
  const ids = {
    date: useId(),
    snow: useId(),
    obs: useId(),
    text: useId(),
    error: useId(),
  };
  const raw = store.useValue();
  const notes = useMemo(() => parseNotes(raw)[slug] ?? [], [raw, slug]);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const optional = (k: string) => {
      const v = String(data.get(k) ?? "").trim();
      return v === "" ? undefined : v;
    };
    const parsed = noteInputSchema(today()).safeParse({
      date: String(data.get("date") ?? ""),
      snowQuality: optional("snowQuality"),
      avalancheObservations: optional("avalancheObservations"),
      text: String(data.get("text") ?? ""),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue.path[0] === "date"
          ? t("errorDate")
          : issue.message === "tooLong"
            ? t("errorTooLong", { max: MAX_NOTE_LENGTH })
            : t("errorText"),
      );
      return;
    }
    setError(null);
    const now = new Date();
    store.write(
      JSON.stringify(
        addNote(parseNotes(store.read()), slug, {
          ...parsed.data,
          id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: now.toISOString(),
        }),
      ),
    );
    form.reset();
  }

  const field =
    "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg";

  return (
    <section aria-labelledby="notes-title" className="space-y-4">
      <h2 id="notes-title" className="text-xl font-semibold">
        {t("title")}
      </h2>
      <p className="max-w-3xl text-sm text-muted">{t("intro")}</p>

      <form
        onSubmit={onSubmit}
        noValidate
        className="grid max-w-3xl gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2"
        aria-describedby={error ? ids.error : undefined}
      >
        <div className="space-y-1">
          <label htmlFor={ids.date} className="text-sm font-medium">
            {t("date")}
          </label>
          <input
            id={ids.date}
            name="date"
            type="date"
            defaultValue={today()}
            max={today()}
            required
            // The server's date can differ from the visitor's local date; the browser's value wins.
            suppressHydrationWarning
            className={field}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={ids.snow} className="text-sm font-medium">
            {t("snowQuality")}
          </label>
          <select id={ids.snow} name="snowQuality" className={field}>
            <option value="">{t("snowUnset")}</option>
            {SNOW_QUALITIES.map((q) => (
              <option key={q} value={q}>
                {t(`snow.${q}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={ids.text} className="text-sm font-medium">
            {t("text")}
          </label>
          <textarea
            id={ids.text}
            name="text"
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            required
            className={field}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={ids.obs} className="text-sm font-medium">
            {t("observations")}
          </label>
          <textarea
            id={ids.obs}
            name="avalancheObservations"
            rows={2}
            maxLength={MAX_NOTE_LENGTH}
            className={field}
          />
        </div>
        {error && (
          <p
            id={ids.error}
            role="alert"
            className="text-sm font-semibold sm:col-span-2"
          >
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg"
          >
            {t("save")}
          </button>
        </div>
      </form>

      {notes.length > 0 && (
        <ul className="max-w-3xl space-y-3" data-testid="condition-notes">
          {notes.map((n) => (
            <li
              key={n.id}
              className="space-y-1 rounded-lg border border-border bg-surface p-4"
            >
              <p className="text-sm font-semibold">
                {format.dateTime(new Date(`${n.date}T00:00:00Z`), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                {n.snowQuality && ` · ${t(`snow.${n.snowQuality}`)}`}
              </p>
              <p className="whitespace-pre-line">{n.text}</p>
              {n.avalancheObservations && (
                <p className="whitespace-pre-line text-sm">
                  <span className="font-medium">{t("observationsShort")}</span>{" "}
                  {n.avalancheObservations}
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  store.write(
                    JSON.stringify(
                      removeNote(parseNotes(store.read()), slug, n.id),
                    ),
                  )
                }
                className="text-sm text-accent underline"
              >
                {t("delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
