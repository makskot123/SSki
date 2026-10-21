"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { InteractiveRose } from "@/components/safety/interactive-rose";
import { ASPECT_ORDER, leeAspects } from "@/lib/safety/terrain";
import type { Aspect } from "@/lib/schemas/resort";

type Mode = "aspect" | "wind";

export function AspectExplorer() {
  const t = useTranslations("Aspects");
  const [mode, setMode] = useState<Mode>("aspect");
  const [aspect, setAspect] = useState<Aspect>("N");
  const [wind, setWind] = useState<Aspect>("W");

  const names = Object.fromEntries(
    ASPECT_ORDER.map((a) => [a, t(`directions.${a}`)]),
  ) as Record<Aspect, string>;

  const lee = leeAspects(wind);
  const selected = mode === "aspect" ? aspect : wind;

  return (
    <div className="grid items-start gap-6 md:grid-cols-[auto_1fr]">
      <div className="space-y-3">
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold">{t("modeLabel")}</legend>
          {(["aspect", "wind"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rose-mode"
                checked={mode === m}
                onChange={() => setMode(m)}
                className="accent-accent"
              />
              {m === "aspect" ? t("modeAspect") : t("modeWind")}
            </label>
          ))}
        </fieldset>

        <InteractiveRose
          selected={selected}
          highlighted={mode === "wind" ? lee : []}
          onSelect={mode === "aspect" ? setAspect : setWind}
          label={t("roseLabel")}
          names={names}
        />

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-3.5 w-3.5 rounded-sm border border-fg"
              style={{ background: "var(--fg)" }}
            />
            {t("selectedLegend")}
          </li>
          {mode === "wind" && (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-sm border border-fg"
                style={{ background: "var(--accent)" }}
              />
              {t("leeLegend")}
            </li>
          )}
        </ul>
      </div>

      <div
        aria-live="polite"
        className="space-y-2 rounded-lg border border-border bg-surface p-4"
      >
        {mode === "aspect" ? (
          <>
            <h3 className="text-lg font-semibold">{names[aspect]}</h3>
            <p>{t(`aspectInfo.${aspect}`)}</p>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold">
              {t("windFrom", { dir: names[wind] })}
            </h3>
            <p>
              {t("windResult", {
                from: names[wind],
                lee: lee.map((a) => names[a]).join(", "),
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
