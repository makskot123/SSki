import { useFormatter, useTranslations } from "next-intl";
import { DataStatusTag } from "@/components/forecast/data-status-tag";
import { ForecastTable } from "@/components/forecast/forecast-table";
import { PowderAlarmBadge } from "@/components/forecast/powder-alarm-badge";
import { WindWarning } from "@/components/forecast/wind-warning";
import { WIND_WARNING_DAYS } from "@/lib/weather/thresholds";
import type { SnowForecast } from "@/lib/weather/types";

export function ForecastSection({
  forecast,
  resortName,
  avalancheAnchor,
}: {
  forecast: SnowForecast;
  resortName: string;
  /** Id of the avalanche section on the same page; the wind warning links to it. */
  avalancheAnchor?: string;
}) {
  const t = useTranslations("Forecast");
  const format = useFormatter();
  const live = forecast.dataStatus === "live";
  const maxWind = Math.max(
    ...forecast.days.slice(0, WIND_WARNING_DAYS).map((d) => d.windMaxKmh),
  );

  return (
    <section aria-labelledby="forecast" className="space-y-4">
      <div className="space-y-1">
        <h2 id="forecast" className="text-xl font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted">
          {t("forElevation", { elevation: format.number(forecast.elevationM) })}
        </p>
        <DataStatusTag
          status={forecast.dataStatus}
          generatedAt={forecast.generatedAt}
        />
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
        <div>
          <dt className="text-muted">{t("past72")}</dt>
          <dd className="font-semibold">
            {t("snowValue", {
              value: format.number(forecast.past72hSnowfallCm),
            })}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("next48")}</dt>
          <dd className="font-semibold">
            {t("snowValue", {
              value: format.number(forecast.next48hSnowfallCm),
            })}
          </dd>
        </div>
      </dl>

      {/* Alerts are only raised from live data; sample data must never look like a real warning. */}
      {live && forecast.powderAlarm && (
        <div>
          <PowderAlarmBadge
            label={t("powderAlarm", {
              cm: format.number(forecast.next48hSnowfallCm),
            })}
          />
        </div>
      )}
      {live && forecast.windWarning && (
        <WindWarning maxWindKmh={maxWind} anchor={avalancheAnchor} />
      )}

      <ForecastTable forecast={forecast} resortName={resortName} />
      <p className="text-xs text-muted">{t("windNote")}</p>
    </section>
  );
}
