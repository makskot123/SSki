import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Checklist } from "@/components/safety/checklist";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/safety/checklist">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Checklist" });
  return { title: t("title") };
}

export default async function ChecklistPage({
  params,
}: PageProps<"/[locale]/safety/checklist">) {
  await resolveLocale(params);
  const t = await getTranslations("Checklist");
  const ts = await getTranslations("Safety");

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link
          href="/safety"
          className="text-sm text-accent underline print:hidden"
        >
          ← {ts("title")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted print:hidden">{t("intro")}</p>
      </header>
      <Checklist />
      <p role="note" className="text-sm text-muted">
        {ts("notSubstitute")}
      </p>
    </div>
  );
}
