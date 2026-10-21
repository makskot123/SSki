import { useFormatter, useTranslations } from "next-intl";
import type { Resort } from "@/lib/schemas/resort";

function monthDay(value: string): Date {
  const [month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(2001, month - 1, day));
}

export function ResortFacts({ resort }: { resort: Resort }) {
  const t = useTranslations("ResortDetail");
  const format = useFormatter();
  const m = (n: number) => `${format.number(n)} m`;
  const eur = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  const day = (value: string) =>
    format.dateTime(monthDay(value), {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  const rows: { label: string; value: string }[] = [
    { label: t("topElevation"), value: m(resort.elevation.top) },
    { label: t("baseElevation"), value: m(resort.elevation.bottom) },
    { label: t("verticalDrop"), value: m(resort.verticalDrop) },
    {
      label: t("steepness"),
      value: `${resort.offPiste.typicalSteepnessDeg.min}–${resort.offPiste.typicalSteepnessDeg.max}°`,
    },
    { label: t("aspects"), value: resort.offPiste.mainAspects.join(", ") },
    {
      label: t("terrainVariety"),
      value: t("terrainVarietyValue", {
        value: resort.offPiste.terrainVariety,
      }),
    },
    {
      label: t("guides"),
      value: resort.guidesAvailable ? t("guidesYes") : t("guidesNo"),
    },
    {
      label: t("beginnerFriendly"),
      value: resort.offPiste.beginnerFriendly ? t("yes") : t("no"),
    },
    {
      label: t("dayPass"),
      value: `${eur(resort.liftPass.dayPriceEUR.min)}–${eur(resort.liftPass.dayPriceEUR.max)}`,
    },
    {
      label: t("season"),
      value: t("seasonRange", {
        from: day(resort.season.opens),
        to: day(resort.season.closes),
      }),
    },
  ];

  return (
    <dl className="divide-y divide-border rounded-lg border border-border bg-surface">
      {rows.map(({ label, value }) => (
        <div
          key={label}
          className="flex justify-between gap-4 px-4 py-2 text-sm"
        >
          <dt className="text-muted">{label}</dt>
          <dd className="text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
