import { useFormatter, useLocale, useTranslations } from "next-intl";
import { isPriceStale } from "@/lib/gear";
import type { GearProduct } from "@/lib/schemas/gear";

const UNITS: Record<string, string> = {
  rangeM: "m",
  searchStripM: "m",
  weightG: "g",
  lengthCm: "cm",
  maxLengthCm: "cm",
  frequencyKHz: "kHz",
  batterySendHours: "h",
  volumeL: "l",
};

/** One product: published specs, RRP with its check date, scores when ranked, and the manufacturer link. */
export function GearProductCard({
  product,
  now,
  rank,
  score,
  performance,
  value,
  failed,
}: {
  product: GearProduct;
  /** ISO time used to flag old prices. */
  now: string;
  rank?: number;
  score?: number;
  performance?: number;
  value?: number;
  /** Message keys of the minimum standards it misses (products below the minimum only). */
  failed?: string[];
}) {
  const t = useTranslations("Gear");
  const format = useFormatter();
  const locale = useLocale() === "pl" ? "pl" : "en";
  const stale = isPriceStale(product.priceCheckedAt, new Date(now));
  const price = format.number(product.priceEUR, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const checked = format.dateTime(
    new Date(`${product.priceCheckedAt}T00:00:00Z`),
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  );

  const specText = (key: string, v: string | number | boolean) => {
    if (typeof v === "boolean") return t(v ? "yes" : "no");
    if (typeof v === "number") {
      const unit = UNITS[key];
      return unit ? `${format.number(v)} ${unit}` : format.number(v);
    }
    return t(`specValues.${v}` as "specValues.metal");
  };

  return (
    <article className="space-y-3 card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {rank !== undefined && (
            <span className="mr-2 text-accent">
              <span aria-hidden="true">#{rank}</span>
              <span className="sr-only">{t("rank", { rank })}</span>
            </span>
          )}
          {product.brand} {product.model}
        </h3>
        {score !== undefined && (
          <p className="text-sm font-semibold text-accent">
            {t("score", { score })}
          </p>
        )}
      </header>

      {failed && failed.length > 0 && (
        <p className="text-sm font-medium">
          {t("belowReason", {
            reasons: failed
              .map((k) => t(`minimums.${k}` as "minimums.digital"))
              .join(", "),
          })}
        </p>
      )}

      {rank !== undefined && (
        <p className="text-sm text-muted">
          {performance === undefined
            ? t("notScored")
            : `${t("performance", { score: Math.round(performance) })} · ${t("value", { score: Math.round(value ?? 0) })}`}
        </p>
      )}

      <p className="text-sm">
        <span className="font-medium">{t("price", { price })}</span>{" "}
        <span className="text-muted">
          ({t("priceChecked", { date: checked })})
        </span>
      </p>
      {stale && (
        <p role="note" className="text-sm font-medium">
          {t("priceStale")}
        </p>
      )}

      <details>
        <summary className="cursor-pointer text-sm font-medium">
          {t("specsTitle")}
        </summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {Object.entries(product.specs).map(([key, v]) =>
            v === undefined ? null : (
              <div key={key} className="contents">
                <dt className="text-muted">
                  {t(`specs.${key}` as "specs.weightG")}
                </dt>
                <dd className="text-right font-medium">{specText(key, v)}</dd>
              </div>
            ),
          )}
        </dl>
      </details>

      {product.notes && (
        <p className="text-sm text-muted">{product.notes[locale]}</p>
      )}

      <p className="text-sm">
        <a
          href={product.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          {t("source")}
          <span className="sr-only"> {t("opensInNewTab")}</span>
        </a>
      </p>
    </article>
  );
}
