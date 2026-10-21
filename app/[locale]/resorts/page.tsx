import { getTranslations } from "next-intl/server";
import { RankingExplorer } from "@/components/resort/ranking-explorer";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { parseRankingQuery } from "@/lib/ranking-query";
import { getResorts } from "@/lib/resorts";
import { getForecasts } from "@/lib/weather";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/resorts">) {
  await resolveLocale(params);
  const t = await getTranslations("Resorts");
  const resorts = getResorts();
  // Weights and filters live in the query string so a ranking can be shared as a link.
  const initial = parseRankingQuery(await searchParams);

  // Live snow feeds the ranking and card badges. Sample data is never used for either.
  const { bySlug, status } = await getForecasts();
  const live = status === "live";
  const conditions = live
    ? Object.fromEntries(
        Object.values(bySlug).map((f) => [f.resortSlug, f.past72hSnowfallCm]),
      )
    : undefined;
  const alarmSlugs = live
    ? Object.values(bySlug)
        .filter((f) => f.powderAlarm)
        .map((f) => f.resortSlug)
    : [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-muted">
          {t("subtitle", { count: resorts.length })}{" "}
          <Link href="/how-we-rank" className="text-accent underline">
            {t("howWeRankLink")}
          </Link>
        </p>
        <p role="note" className="max-w-3xl text-sm text-muted">
          {t("approxNote")}
        </p>
      </header>
      <RankingExplorer
        resorts={resorts}
        initial={initial}
        conditions={conditions}
        alarmSlugs={alarmSlugs}
      />
    </div>
  );
}
