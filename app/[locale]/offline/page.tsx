import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Disclaimer } from "@/components/ui/disclaimer";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/offline">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Pwa" });
  return { title: t("offlineTitle"), robots: { index: false } };
}

/** Served by the service worker when a page is requested offline and was never saved. */
export default async function OfflinePage({
  params,
}: PageProps<"/[locale]/offline">) {
  await resolveLocale(params);
  const t = await getTranslations("Pwa");

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{t("offlineTitle")}</h1>
      <p>{t("offlineBody")}</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <Link href="/safety/checklist" className="text-accent underline">
            {t("offlineChecklist")}
          </Link>
        </li>
        <li>
          <Link href="/safety/quiz" className="text-accent underline">
            {t("offlineQuiz")}
          </Link>
        </li>
        <li>
          <Link href="/safety" className="text-accent underline">
            {t("offlineSafety")}
          </Link>
        </li>
      </ul>
      <p className="font-medium">{t("offlineAvalanche")}</p>
      <Disclaimer />
    </div>
  );
}
