import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { AvalancheExplorer } from "@/components/avalanche/avalanche-explorer";
import { Disclaimer } from "@/components/ui/disclaimer";
import { getAvalancheData } from "@/lib/avalanche";
import { PROVIDER_IDS, PROVIDERS } from "@/lib/avalanche/providers";
import { currentLevels, toView } from "@/lib/avalanche/view";
import { resolveLocale } from "@/i18n/locale-param";

// Bulletins change a few times a day; the feeds themselves are cached for 15 minutes.
export const revalidate = 900;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/avalanche">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Avalanche" });
  return { title: t("title") };
}

export default async function AvalanchePage({
  params,
}: PageProps<"/[locale]/avalanche">) {
  await resolveLocale(params);
  const t = await getTranslations("Avalanche");
  const format = await getFormatter();

  const { index, feeds } = await getAvalancheData();
  const view = toView(index);
  const currentCount = Object.keys(currentLevels(view)).length;
  const latest = view.bulletins
    .map((b) => b.publicationTime)
    .sort()
    .at(-1);
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Vienna",
      timeZoneName: "short",
    });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-muted">{t("intro")}</p>
        <div className="max-w-3xl rounded-lg border-2 border-fg bg-surface p-3 font-medium">
          <Disclaimer className="text-fg!" />
        </div>
        <div className="space-y-1 text-sm" aria-live="polite">
          <p className="font-semibold">
            {currentCount > 0
              ? t("summaryCurrent", { count: currentCount })
              : t("summaryNone")}
          </p>
          {latest && (
            <p className="text-muted">
              {t("lastPublished", { time: when(latest) })}
            </p>
          )}
        </div>
      </header>

      <AvalancheExplorer view={view} />

      <section
        aria-labelledby="feeds-title"
        className="space-y-2 border-t border-border pt-4"
      >
        <h2 id="feeds-title" className="text-sm font-semibold">
          {t("feedsTitle")}
        </h2>
        <ul className="space-y-1 text-sm text-muted">
          {PROVIDER_IDS.map((id) => (
            <li key={id}>
              {feeds[id].state === "live"
                ? t("feedLive", {
                    name: PROVIDERS[id].name,
                    count: feeds[id].count,
                  })
                : t("feedUnavailable", { name: PROVIDERS[id].name })}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          {t("attribution", {
            providers: PROVIDER_IDS.map(
              (id) => `${PROVIDERS[id].name} (${PROVIDERS[id].license})`,
            ).join("; "),
          })}
        </p>
      </section>
    </div>
  );
}
