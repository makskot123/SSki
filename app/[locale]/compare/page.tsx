import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { AvalancheCell } from "@/components/compare/avalanche-cell";
import { ComparePicker } from "@/components/compare/compare-picker";
import { DataStatusTag } from "@/components/forecast/data-status-tag";
import { PowderAlarmBadge } from "@/components/forecast/powder-alarm-badge";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { getAvalancheData } from "@/lib/avalanche";
import { regionLabel, regionMeta } from "@/lib/avalanche/meta";
import { resortAvalanche } from "@/lib/avalanche/resort-status";
import { MAX_COMPARE } from "@/lib/compare";
import { countryName, monthDayDate } from "@/lib/format";
import { getResortBySlug, getResorts } from "@/lib/resorts";
import { getForecasts } from "@/lib/weather";
import { WIND_WARNING_DAYS } from "@/lib/weather/thresholds";
import { TableScroll } from "@/components/ui/table-scroll";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compare">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Compare" });
  return { title: t("title") };
}

/** ?r=a,b,c -> up to three existing, distinct resorts, in the given order. */
function parseSelection(value: string | string[] | undefined) {
  const raw = (Array.isArray(value) ? value[0] : value) ?? "";
  const slugs = [...new Set(raw.split(",").filter(Boolean))];
  return slugs
    .flatMap((slug) => {
      const resort = getResortBySlug(slug);
      return resort ? [resort] : [];
    })
    .slice(0, MAX_COMPARE);
}

export default async function ComparePage({
  params,
  searchParams,
}: PageProps<"/[locale]/compare">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Compare");
  const tr = await getTranslations("ResortDetail");
  const tf = await getTranslations("Forecast");
  const format = await getFormatter();

  const selected = parseSelection((await searchParams).r);
  const options = getResorts()
    .map((r) => ({ slug: r.slug, name: r.name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const header = (
    <header className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="max-w-3xl text-muted">{t("subtitle")}</p>
      <ComparePicker options={options} selected={selected.map((r) => r.slug)} />
    </header>
  );

  if (selected.length < 2) {
    return (
      <div className="space-y-6">
        {header}
        <p
          role="status"
          className="rounded-lg border border-border bg-surface p-4"
        >
          {t("needTwo")}
        </p>
        <Link href="/resorts" className="text-accent underline">
          {t("backToRanking")}
        </Link>
      </div>
    );
  }

  const now = new Date();
  const [{ bySlug, status }, { index, feeds }] = await Promise.all([
    getForecasts(now),
    getAvalancheData(now),
  ]);
  const live = status === "live";

  const m = (n: number) => `${format.number(n)} m`;
  const eur = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
  const day = (value: string) =>
    format.dateTime(monthDayDate(value), {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  const cm = (n: number) => tf("snowValue", { value: format.number(n) });
  const yesNo = (v: boolean) => (v ? tr("yes") : tr("no"));

  const columns = selected.map((resort) => {
    const forecast = bySlug[resort.slug];
    const maxWind = Math.max(
      0,
      ...forecast.days.slice(0, WIND_WARNING_DAYS).map((d) => d.windMaxKmh),
    );
    const avalanche = resortAvalanche(resort, index, feeds, (id) =>
      regionLabel(
        regionMeta,
        id,
        locale,
        index.get(id)?.bulletin.regionNames[id],
      ),
    );
    return { resort, forecast, maxWind, avalanche };
  });

  type Row = {
    label: string;
    cell: (c: (typeof columns)[number]) => React.ReactNode;
  };
  const rows: Row[] = [
    {
      label: t("rowLocation"),
      cell: ({ resort }) =>
        `${resort.region}, ${countryName(resort.country, locale)}`,
    },
    {
      label: tr("topElevation"),
      cell: ({ resort }) => m(resort.elevation.top),
    },
    {
      label: tr("baseElevation"),
      cell: ({ resort }) => m(resort.elevation.bottom),
    },
    { label: tr("verticalDrop"), cell: ({ resort }) => m(resort.verticalDrop) },
    {
      label: tr("steepness"),
      cell: ({ resort }) =>
        `${resort.offPiste.typicalSteepnessDeg.min}–${resort.offPiste.typicalSteepnessDeg.max}°`,
    },
    {
      label: tr("aspects"),
      cell: ({ resort }) => resort.offPiste.mainAspects.join(", "),
    },
    {
      label: tr("terrainVariety"),
      cell: ({ resort }) =>
        tr("terrainVarietyValue", { value: resort.offPiste.terrainVariety }),
    },
    {
      label: tr("guides"),
      cell: ({ resort }) =>
        resort.guidesAvailable ? tr("guidesYes") : tr("guidesNo"),
    },
    {
      label: tr("beginnerFriendly"),
      cell: ({ resort }) => yesNo(resort.offPiste.beginnerFriendly),
    },
    {
      label: tr("dayPass"),
      cell: ({ resort }) =>
        `${eur(resort.liftPass.dayPriceEUR.min)}–${eur(resort.liftPass.dayPriceEUR.max)}`,
    },
    {
      label: tr("season"),
      cell: ({ resort }) =>
        tr("seasonRange", {
          from: day(resort.season.opens),
          to: day(resort.season.closes),
        }),
    },
    {
      label: t("rowSnowfall"),
      cell: ({ resort }) =>
        resort.climatology ? cm(resort.climatology.avgSeasonSnowfallCm) : "–",
    },
    {
      label: tf("past72"),
      cell: ({ forecast }) => cm(forecast.past72hSnowfallCm),
    },
    {
      label: tf("next48"),
      cell: ({ forecast }) => (
        <div className="space-y-1">
          <p>{cm(forecast.next48hSnowfallCm)}</p>
          {/* Alerts come from live data only; sample data never raises one. */}
          {live && forecast.powderAlarm && (
            <PowderAlarmBadge label={t("alarm")} />
          )}
        </div>
      ),
    },
    {
      label: t("rowWind"),
      cell: ({ forecast, maxWind }) => (
        <div className="space-y-1">
          <p>{format.number(maxWind)} km/h</p>
          {live && forecast.windWarning && (
            <p className="font-semibold">{t("windWarning")}</p>
          )}
        </div>
      ),
    },
    {
      label: t("rowAvalanche"),
      cell: ({ resort, avalanche }) => (
        <AvalancheCell
          avalanche={avalanche}
          slug={resort.slug}
          renderedAt={now.toISOString()}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {header}
      <DataStatusTag
        status={status}
        generatedAt={columns[0].forecast.generatedAt}
      />

      <TableScroll label={t("caption")}>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead className="bg-surface">
            <tr>
              <td className="px-3 py-2" />
              {columns.map(({ resort }) => (
                <th
                  key={resort.slug}
                  scope="col"
                  className="px-3 py-2 text-base font-semibold"
                >
                  <Link
                    href={`/resorts/${resort.slug}`}
                    className="text-accent underline"
                  >
                    {resort.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="px-3 py-2 align-top font-medium text-muted"
                >
                  {row.label}
                </th>
                {columns.map((c) => (
                  <td key={c.resort.slug} className="px-3 py-2 align-top">
                    {row.cell(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p role="note" className="text-sm text-muted">
        {tr("approxNote")}
      </p>
      <Link href="/resorts" className="text-accent underline">
        {t("backToRanking")}
      </Link>
    </div>
  );
}
