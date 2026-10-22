"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { useNow } from "@/components/avalanche/use-now";
import { AvalancheCell } from "@/components/compare/avalanche-cell";
import { FavouriteButton } from "@/components/favourites/favourite-button";
import { useFavourites } from "@/components/favourites/use-favourites";
import { Link } from "@/i18n/navigation";
import {
  summariseResort,
  type ResortAvalanche,
} from "@/lib/avalanche/resort-status";
import { HIGH_DANGER_LEVEL, orderPlan, type PlanRow } from "@/lib/planner";

export interface PlannerRow extends PlanRow {
  name: string;
  place: string;
  avalanche: ResortAvalanche;
}

/**
 * The shortlist. Ordered here, in the browser, because the "high danger goes last" rule must use levels
 * re-checked with the visitor's clock (the page is cached for minutes).
 */
export function PlannerResults({
  rows,
  renderedAt,
  partial,
}: {
  rows: PlannerRow[];
  renderedAt: string;
  /** Covered days when the forecast covers only part of the trip. */
  partial?: number;
}) {
  const t = useTranslations("Planner");
  const format = useFormatter();
  const savedId = useId();
  const now = useNow();
  const slugs = useMemo(() => rows.map((r) => r.slug), [rows]);
  const { favourites } = useFavourites(slugs);
  const [onlySaved, setOnlySaved] = useState(false);

  const levelOf = useMemo(() => {
    const at = now ?? new Date(renderedAt);
    const levels = new Map(
      rows.map((r) => [
        r.slug,
        r.avalanche.kind === "covered"
          ? summariseResort(r.avalanche.regions, at).maxLevel
          : null,
      ]),
    );
    return (r: PlannerRow) => levels.get(r.slug) ?? null;
  }, [rows, now, renderedAt]);

  const ordered = useMemo(() => orderPlan(rows, levelOf), [rows, levelOf]);
  const shown = onlySaved
    ? ordered.filter((r) => favourites.includes(r.slug))
    : ordered;

  return (
    <div className="space-y-4">
      <label
        htmlFor={savedId}
        className="flex w-fit items-center gap-2 text-sm print:hidden"
      >
        <input
          id={savedId}
          type="checkbox"
          checked={onlySaved}
          onChange={(e) => setOnlySaved(e.target.checked)}
          className="accent-accent"
        />
        {t("onlySaved")}
      </label>

      {shown.length === 0 ? (
        <p>{onlySaved ? t("noSaved") : t("noResults")}</p>
      ) : (
        <ol className="space-y-3" data-testid="planner-results">
          {shown.map((r, i) => {
            const level = levelOf(r);
            return (
              <li
                key={r.slug}
                className="flex break-inside-avoid gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <h3 className="text-lg font-semibold">
                      <span className="mr-2 text-accent">{i + 1}.</span>
                      <Link href={`/resorts/${r.slug}`} className="underline">
                        {r.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-muted">{r.place}</p>
                  </div>
                  <p className="text-sm">
                    <span className="font-semibold">
                      {t("score", { score: Math.round(r.planScore) })}
                    </span>
                    <span className="text-muted">
                      {" · "}
                      {t("resortScore", { score: Math.round(r.baseScore) })}
                    </span>
                  </p>
                  <p className="text-sm">
                    {r.tripSnowCm === null
                      ? t("noTripSnow")
                      : partial !== undefined
                        ? t("tripSnowPartial", {
                            cm: format.number(r.tripSnowCm),
                            covered: partial,
                          })
                        : t("tripSnow", { cm: format.number(r.tripSnowCm) })}
                  </p>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{t("avalancheNow")}</p>
                    <AvalancheCell
                      avalanche={r.avalanche}
                      slug={r.slug}
                      renderedAt={renderedAt}
                    />
                    {level !== null && level >= HIGH_DANGER_LEVEL && (
                      <p className="font-semibold">{t("highDanger")}</p>
                    )}
                  </div>
                </div>
                <FavouriteButton
                  slug={r.slug}
                  name={r.name}
                  className="print:hidden"
                />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
