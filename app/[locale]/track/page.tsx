import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SkiTracker } from "@/components/tracker/ski-tracker";
import { resolveLocale } from "@/i18n/locale-param";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/track">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Tracker" });
  return { title: t("title") };
}

export default async function TrackPage({
  params,
}: PageProps<"/[locale]/track">) {
  await resolveLocale(params);
  const t = await getTranslations("Tracker");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </header>
      <SkiTracker />
    </div>
  );
}
