import { useFormatter, useTranslations } from "next-intl";
import { degToCompass } from "@/lib/weather/map";
import type { SnowForecast } from "@/lib/weather/types";

export function ForecastTable({
  forecast,
  resortName,
}: {
  forecast: SnowForecast;
  resortName: string;
}) {
  const t = useTranslations("Forecast");
  const format = useFormatter();
  const n = (v: number) => format.number(v);

  if (forecast.days.length === 0) {
    return <p className="text-muted">{t("noDays")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">
          {t("caption", { name: resortName })}
        </caption>
        <thead className="bg-surface">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">
              {t("day")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t("snow")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t("temp")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t("freezing")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t("wind")}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {t("gusts")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {forecast.days.map((d) => (
            <tr key={d.date}>
              <th scope="row" className="px-3 py-2 font-medium">
                {format.dateTime(new Date(`${d.date}T00:00:00Z`), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </th>
              <td className="px-3 py-2 text-right font-medium">
                {t("snowValue", { value: n(d.snowfallCm) })}
              </td>
              <td className="px-3 py-2 text-right">
                {n(d.tempMinC)}° / {n(d.tempMaxC)}°
              </td>
              <td className="px-3 py-2 text-right">
                {d.freezingLevelM === null ? "–" : `${n(d.freezingLevelM)} m`}
              </td>
              <td className="px-3 py-2 text-right">
                {n(d.windMaxKmh)} km/h{" "}
                <span className="text-muted">
                  {t("windFrom", { dir: degToCompass(d.windDirectionDeg) })}
                </span>
              </td>
              <td className="px-3 py-2 text-right">{n(d.windGustKmh)} km/h</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
