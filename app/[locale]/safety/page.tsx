import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/ui/coming-soon";
import { resolveLocale } from "@/i18n/locale-param";

export default async function Page({ params }: PageProps<"/[locale]/safety">) {
  await resolveLocale(params);
  const t = await getTranslations("Nav");
  return <ComingSoon title={t("safety")} />;
}
