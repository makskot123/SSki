import { z } from "zod";
import type { Resort } from "@/lib/schemas/resort";
import { toSnowForecast } from "./map";
import type { SnowForecast } from "./types";

const numbers = z.array(z.number().nullable());

const locationSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    snowfall: numbers,
    freezing_level_height: numbers,
  }),
  daily: z.object({
    time: z.array(z.string()),
    snowfall_sum: numbers,
    temperature_2m_max: numbers,
    temperature_2m_min: numbers,
    wind_speed_10m_max: numbers,
    wind_gusts_10m_max: numbers,
    wind_direction_10m_dominant: numbers,
  }),
});

export type OpenMeteoLocation = z.infer<typeof locationSchema>;

/** One location comes back as an object, several as an array. */
export const openMeteoResponseSchema = z
  .union([z.array(locationSchema), locationSchema.transform((l) => [l])])
  .pipe(z.array(locationSchema));

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

/** One request for all resorts, at summit elevation, so the whole site costs a single API call per hour. */
export function buildForecastUrl(resorts: Resort[]): string {
  const params = new URLSearchParams({
    latitude: resorts.map((r) => r.summitPoint.lat).join(","),
    longitude: resorts.map((r) => r.summitPoint.lon).join(","),
    elevation: resorts.map((r) => r.summitPoint.elevation).join(","),
    daily: [
      "snowfall_sum",
      "temperature_2m_max",
      "temperature_2m_min",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "wind_direction_10m_dominant",
    ].join(","),
    hourly: "snowfall,freezing_level_height",
    past_days: "3",
    forecast_days: "7",
    timezone: "GMT",
  });
  return `${BASE_URL}?${params.toString()}`;
}

/** Response schema bound to the resort list: validates the count and maps to SnowForecast. */
export function forecastSchemaFor(
  resorts: Resort[],
  now: Date,
): z.ZodType<SnowForecast[], unknown> {
  return openMeteoResponseSchema
    .refine((locations) => locations.length === resorts.length, {
      message: `expected ${resorts.length} locations`,
    })
    .transform((locations) =>
      locations.map((loc, i) => toSnowForecast(loc, resorts[i], now, "live")),
    );
}
