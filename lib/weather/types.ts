import type { DataStatus } from "@/lib/fetch-with-fallback";

export interface SnowForecastDay {
  /** UTC calendar date, YYYY-MM-DD. */
  date: string;
  snowfallCm: number;
  /** Mean freezing level over the day; null if the model gave no value. */
  freezingLevelM: number | null;
  tempMinC: number;
  tempMaxC: number;
  windMaxKmh: number;
  windGustKmh: number;
  windDirectionDeg: number;
}

export interface SnowForecast {
  resortSlug: string;
  generatedAt: string;
  /** Elevation the forecast was downscaled to (summit). */
  elevationM: number;
  days: SnowForecastDay[];
  past72hSnowfallCm: number;
  next48hSnowfallCm: number;
  powderAlarm: boolean;
  windWarning: boolean;
  dataStatus: DataStatus;
}
