import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/i18n/locale-param";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  await resolveLocale(params);
  const t = await getTranslations("Home");

  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="max-w-2xl text-lg text-muted">{t("subtitle")}</p>
      <p className="text-sm text-muted">{t("comingSoon")}</p>
    </section>
  );
}
