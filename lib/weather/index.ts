import { fetchWithFallback, type DataStatus } from "@/lib/fetch-with-fallback";
import { getResorts } from "@/lib/resorts";
import { mockForecast } from "./mock";
import { buildForecastUrl, forecastSchemaFor } from "./open-meteo";
import type { SnowForecast } from "./types";

export interface Forecasts {
  bySlug: Record<string, SnowForecast>;
  status: DataStatus;
}

/** Forecasts for every resort in one cached request (revalidated hourly), with sample-data fallback. */
export async function getForecasts(now: Date = new Date()): Promise<Forecasts> {
  const resorts = getResorts();
  const { data, status } = await fetchWithFallback({
    url: buildForecastUrl(resorts),
    schema: forecastSchemaFor(resorts, now),
    fallback: () => resorts.map((r) => mockForecast(r, now)),
    revalidate: 3600,
    label: "Open-Meteo forecast",
  });
  return {
    bySlug: Object.fromEntries(data.map((f) => [f.resortSlug, f])),
    status,
  };
}
