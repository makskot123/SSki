import { z } from "zod";

/** Personal condition notes, kept only on the device. Versioned so the format can change later. */
export const NOTES_STORAGE_KEY = "freeride-atlas:notes:v1";
export const MAX_NOTE_LENGTH = 1000;
export const MAX_NOTES_PER_RESORT = 50;

export const SNOW_QUALITIES = [
  "powder",
  "crud",
  "wind_packed",
  "crust",
  "spring",
  "ice",
] as const;

const isoDate = z.iso.date();

export const noteSchema = z.strictObject({
  id: z.string().min(1).max(64),
  /** Day the conditions were seen. */
  date: isoDate,
  snowQuality: z.enum(SNOW_QUALITIES).optional(),
  /** Signs of instability seen (cracks, whumpfs, recent avalanches). Free text. */
  avalancheObservations: z.string().trim().max(MAX_NOTE_LENGTH).optional(),
  text: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
  createdAt: z.iso.datetime(),
});
export type ConditionNote = z.infer<typeof noteSchema>;

const storeSchema = z.record(z.string(), z.array(z.unknown()));

/**
 * Reads stored notes defensively: invalid entries are dropped one by one, so one bad note never hides
 * the others. Result is per resort slug, newest observation date first.
 */
export function parseNotes(
  raw: string | null | undefined,
): Record<string, ConditionNote[]> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const store = storeSchema.safeParse(parsed);
  if (!store.success) return {};
  const out: Record<string, ConditionNote[]> = {};
  for (const [slug, list] of Object.entries(store.data)) {
    const notes = list.flatMap((n) => {
      const r = noteSchema.safeParse(n);
      return r.success ? [r.data] : [];
    });
    if (notes.length) out[slug] = sortNotes(notes);
  }
  return out;
}

function sortNotes(notes: ConditionNote[]) {
  return [...notes].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** Form input, validated before saving. The date may not be in the future (`today` is YYYY-MM-DD). */
export function noteInputSchema(today: string) {
  return z.strictObject({
    date: isoDate.refine((d) => d <= today, { message: "future" }),
    snowQuality: z.enum(SNOW_QUALITIES).optional(),
    avalancheObservations: z.string().trim().max(MAX_NOTE_LENGTH).optional(),
    text: z
      .string()
      .trim()
      .min(1, { message: "required" })
      .max(MAX_NOTE_LENGTH, { message: "tooLong" }),
  });
}
export type NoteInput = z.infer<ReturnType<typeof noteInputSchema>>;

export function addNote(
  notes: Record<string, ConditionNote[]>,
  slug: string,
  note: ConditionNote,
): Record<string, ConditionNote[]> {
  const list = sortNotes([note, ...(notes[slug] ?? [])]).slice(
    0,
    MAX_NOTES_PER_RESORT,
  );
  return { ...notes, [slug]: list };
}

export function removeNote(
  notes: Record<string, ConditionNote[]>,
  slug: string,
  id: string,
): Record<string, ConditionNote[]> {
  const list = (notes[slug] ?? []).filter((n) => n.id !== id);
  const next = { ...notes };
  if (list.length) next[slug] = list;
  else delete next[slug];
  return next;
}
