"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DangerBadge } from "@/components/avalanche/danger-badge";
import { useNow } from "@/components/avalanche/use-now";
import { Link } from "@/i18n/navigation";
import {
  summariseResort,
  type ResortAvalanche,
} from "@/lib/avalanche/resort-status";

/**
 * Compact avalanche status (compare table, home page cards). Same rule as the resort page: no level unless
 * current now, re-checked with the visitor's clock.
 */
export function AvalancheCell({
  avalanche,
  slug,
  renderedAt,
}: {
  avalanche: ResortAvalanche;
  slug: string;
  renderedAt: string;
}) {
  const t = useTranslations("ResortAvalanche");
  const format = useFormatter();
  const browserNow = useNow();

  const more = (
    <Link href={`/resorts/${slug}#avalanche`} className="text-accent underline">
      {t("cellDetails")}
    </Link>
  );

  if (avalanche.kind === "no_service") return <>{t("cellNoService")}</>;
  if (avalanche.kind === "not_covered") {
    return (
      <div className="space-y-1">
        <p>{t("cellNotCovered")}</p>
        {more}
      </div>
    );
  }

  const summary = summariseResort(
    avalanche.regions,
    browserNow ?? new Date(renderedAt),
  );
  if (summary.state === "current" && summary.maxLevel) {
    const until = summary.current
      .flatMap((r) => (r.bulletin ? [r.bulletin.validUntil] : []))
      .sort()[0];
    return (
      <div className="space-y-1">
        <DangerBadge level={summary.maxLevel} />
        {until && (
          <p className="text-xs text-muted">
            {t("validUntil", {
              time: format.dateTime(new Date(until), {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Vienna",
                timeZoneName: "short",
              }),
            })}
          </p>
        )}
        {summary.current[0]?.bulletin && (
          <p className="text-xs text-muted">
            {t("source", {
              provider: summary.current[0].bulletin.provider.name,
              license: summary.current[0].bulletin.provider.license,
            })}
          </p>
        )}
        {more}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className="font-medium">{t("noCurrent")}</p>
      {more}
    </div>
  );
}
