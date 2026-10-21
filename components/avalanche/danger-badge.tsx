import { useTranslations } from "next-intl";
import { DANGER_COLORS } from "@/lib/palette";
import type { DangerLevel } from "@/lib/schemas/avalanche";

/** Colour is never the only signal: the number and the word are always printed. */
export function DangerBadge({
  level,
  large = false,
}: {
  level: DangerLevel;
  large?: boolean;
}) {
  const t = useTranslations("Avalanche");
  const { fill, text } = DANGER_COLORS[level];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border border-fg/40 px-2.5 py-1 font-semibold ${large ? "text-lg" : "text-sm"}`}
      style={{ backgroundColor: fill, color: text }}
    >
      <span aria-hidden="true">{level}</span>
      <span className="sr-only">{t("level", { level })}: </span>
      <span>{t(`levels.${level}`)}</span>
    </span>
  );
}
