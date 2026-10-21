import { getTranslations } from "next-intl/server";
import { ResortCard } from "@/components/resort/resort-card";
import { resolveLocale } from "@/i18n/locale-param";
import { getResorts } from "@/lib/resorts";

export default async function Page({ params }: PageProps<"/[locale]/resorts">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Resorts");
  const resorts = [...getResorts()].sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-muted">
          {t("subtitle", { count: resorts.length })}
        </p>
        <p role="note" className="max-w-3xl text-sm text-muted">
          {t("approxNote")}
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resorts.map((resort) => (
          <li key={resort.slug}>
            <ResortCard resort={resort} />
          </li>
        ))}
      </ul>
    </div>
  );
}
