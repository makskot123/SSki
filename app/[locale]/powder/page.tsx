import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { DataStatusTag } from "@/components/forecast/data-status-tag";
import { PowderAlarmBadge } from "@/components/forecast/powder-alarm-badge";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { getResorts } from "@/lib/resorts";
import { getForecasts } from "@/lib/weather";
import { snowOnDates, weekendDates } from "@/lib/weather/map";
import { WIND_WARNING_DAYS } from "@/lib/weather/thresholds";
import { TableScroll } from "@/components/ui/table-scroll";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/powder">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Powder" });
  return { title: t("title") };
}

export default async function PowderPage({
  params,
}: PageProps<"/[locale]/powder">) {
  await resolveLocale(params);
  const t = await getTranslations("Powder");
  const tf = await getTranslations("Forecast");
  const format = await getFormatter();

  const now = new Date();
  const { bySlug, status } = await getForecasts(now);
  const weekend = weekendDates(now);
  const live = status === "live";

  const rows = getResorts()
    .map((resort) => {
      const forecast = bySlug[resort.slug];
      const weekendSnow = snowOnDates(forecast, weekend);
      return {
        resort,
        forecast,
        weekendCm: weekendSnow.cm,
        complete: weekendSnow.complete,
        maxWind: Math.max(
          0,
          ...forecast.days.slice(0, WIND_WARNING_DAYS).map((d) => d.windMaxKmh),
        ),
      };
    })
    .sort(
      (a, b) =>
        b.weekendCm - a.weekendCm ||
        b.forecast.next48hSnowfallCm - a.forecast.next48hSnowfallCm ||
        a.resort.name.localeCompare(b.resort.name, "en"),
    );

  const fmtDay = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  const range =
    weekend.length > 1
      ? `${fmtDay(weekend[0])} – ${fmtDay(weekend[weekend.length - 1])}`
      : fmtDay(weekend[0]);
  const incomplete = rows.some((r) => !r.complete);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-muted">{t("subtitle", { range })}</p>
        <DataStatusTag
          status={status}
          generatedAt={rows[0]?.forecast.generatedAt}
        />
        <p role="note" className="max-w-3xl text-sm text-muted">
          {t("seasonNote")}
        </p>
        {incomplete && <p className="text-sm text-muted">{t("incomplete")}</p>}
      </header>

      <TableScroll label={t("caption")}>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                {t("colResort")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                {t("colWeekend")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                {t("col48")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                {t("colWind")}
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                {t("colAlerts")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ resort, forecast, weekendCm, maxWind }) => (
              <tr key={resort.slug}>
                <th scope="row" className="px-3 py-2 font-medium">
                  <Link
                    href={`/resorts/${resort.slug}`}
                    className="text-accent underline"
                  >
                    {resort.name}
                  </Link>
                </th>
                <td className="px-3 py-2 text-right font-semibold">
                  {tf("snowValue", { value: format.number(weekendCm) })}
                </td>
                <td className="px-3 py-2 text-right">
                  {tf("snowValue", {
                    value: format.number(forecast.next48hSnowfallCm),
                  })}
                </td>
                <td className="px-3 py-2 text-right">
                  {format.number(maxWind)} km/h
                </td>
                <td className="px-3 py-2">
                  {/* Alerts come from live data only; sample data never raises one. */}
                  {live && forecast.powderAlarm && (
                    <PowderAlarmBadge label={t("alarmShort")} />
                  )}{" "}
                  {live && forecast.windWarning && (
                    <Link href="/avalanche" className="text-accent underline">
                      {t("windShort")}
                    </Link>
                  )}
                  {!(
                    live &&
                    (forecast.powderAlarm || forecast.windWarning)
                  ) && <span className="text-muted">{t("none")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p className="text-xs text-muted">{tf("windNote")}</p>
    </div>
  );
}
