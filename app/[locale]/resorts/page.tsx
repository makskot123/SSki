import { getTranslations } from "next-intl/server";
import { RankingExplorer } from "@/components/resort/ranking-explorer";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { parseRankingQuery } from "@/lib/ranking-query";
import { getResorts } from "@/lib/resorts";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/resorts">) {
  await resolveLocale(params);
  const t = await getTranslations("Resorts");
  const resorts = getResorts();
  // Weights and filters live in the query string so a ranking can be shared as a link.
  const initial = parseRankingQuery(await searchParams);

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
      <RankingExplorer resorts={resorts} initial={initial} />
    </div>
  );
}
