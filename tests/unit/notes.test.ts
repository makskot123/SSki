import { describe, expect, it } from "vitest";
import {
  addNote,
  MAX_NOTE_LENGTH,
  noteInputSchema,
  parseNotes,
  removeNote,
  type ConditionNote,
} from "@/lib/notes";

const note = (id: string, date: string, text = "Good snow"): ConditionNote => ({
  id,
  date,
  text,
  createdAt: `${date}T10:00:00.000Z`,
});

describe("parseNotes", () => {
  it("returns nothing for missing or corrupt storage", () => {
    expect(parseNotes(null)).toEqual({});
    expect(parseNotes("{oops")).toEqual({});
    expect(parseNotes("[1,2]")).toEqual({});
  });

  it("drops invalid notes one by one and sorts newest first", () => {
    const raw = JSON.stringify({
      chamonix: [
        note("a", "2026-01-02"),
        { id: "bad" },
        note("b", "2026-02-10"),
      ],
      zermatt: [{ nonsense: true }],
    });
    const parsed = parseNotes(raw);
    expect(parsed.chamonix.map((n) => n.id)).toEqual(["b", "a"]);
    expect(parsed.zermatt).toBeUndefined();
  });
});

describe("note input", () => {
  const schema = noteInputSchema("2026-10-22");

  it("needs text and a date that is not in the future", () => {
    expect(
      schema.safeParse({ date: "2026-10-22", text: "Wind crust up high" })
        .success,
    ).toBe(true);
    expect(schema.safeParse({ date: "2026-10-23", text: "x" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ date: "2026-10-20", text: "   " }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({
        date: "2026-10-20",
        text: "x".repeat(MAX_NOTE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ date: "2026-10-20", text: "x", snowQuality: "slush" })
        .success,
    ).toBe(false);
  });
});

describe("add and remove", () => {
  it("adds per resort and removes by id, dropping empty resorts", () => {
    let notes = addNote({}, "verbier", note("a", "2026-01-01"));
    notes = addNote(notes, "verbier", note("b", "2026-01-05"));
    expect(notes.verbier.map((n) => n.id)).toEqual(["b", "a"]);
    notes = removeNote(notes, "verbier", "b");
    notes = removeNote(notes, "verbier", "a");
    expect(notes).toEqual({});
  });
});
