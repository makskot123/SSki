import { describe, expect, it } from "vitest";
import { DANGER_COLORS } from "@/lib/palette";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";

describe("EAWS palette", () => {
  it("defines levels 1-5 with distinct colours", () => {
    const fills = Object.values(DANGER_COLORS).map((c) => c.fill);
    expect(fills).toHaveLength(5);
    expect(new Set(fills).size).toBe(5);
  });
});

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("i18n messages", () => {
  it("en and pl have identical keys", () => {
    expect(keys(pl).sort()).toEqual(keys(en).sort());
  });
});
