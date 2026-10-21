import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/format";
import type { Resort } from "@/lib/schemas/resort";

export function ResortCard({
  resort,
  rank,
  score,
}: {
  resort: Resort;
  rank?: number;
  /** Rounded 0-100 ranking score. */
  score?: number;
}) {
  const t = useTranslations("Resorts");
  const tr = useTranslations("Ranking");
  const locale = useLocale();
  const format = useFormatter();
  const m = (n: number) => `${format.number(n)} m`;
  const eur = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });

  return (
    <article className="relative flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 focus-within:ring-2 focus-within:ring-accent hover:border-accent">
      <header className="space-y-1">
        {rank !== undefined && score !== undefined && (
          <p className="flex items-baseline justify-between text-sm font-semibold text-accent">
            <span>
              <span aria-hidden="true">#{rank}</span>
              <span className="sr-only">{tr("rank", { rank })}</span>
            </span>
            <span>
              <span aria-hidden="true">{score}/100</span>
              <span className="sr-only">{tr("scoreLabel", { score })}</span>
            </span>
          </p>
        )}
        <h2 className="text-lg font-semibold">
          <Link
            href={`/resorts/${resort.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            aria-label={t("viewResort", { name: resort.name })}
          >
            {resort.name}
          </Link>
        </h2>
        <p className="text-sm text-muted">
          {resort.region}, {countryName(resort.country, locale)}
        </p>
      </header>
      <p className="text-sm">{resort.description[locale]}</p>
      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("top")}</dt>
        <dd className="text-right font-medium">{m(resort.elevation.top)}</dd>
        <dt className="text-muted">{t("base")}</dt>
        <dd className="text-right font-medium">{m(resort.elevation.bottom)}</dd>
        <dt className="text-muted">{t("vertical")}</dt>
        <dd className="text-right font-medium">{m(resort.verticalDrop)}</dd>
        <dt className="text-muted">{t("dayPass")}</dt>
        <dd className="text-right font-medium">
          {eur(resort.liftPass.dayPriceEUR.min)}–
          {eur(resort.liftPass.dayPriceEUR.max)}
        </dd>
      </dl>
    </article>
  );
}
