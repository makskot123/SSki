/** Powder Alarm: at least this much new snow forecast within POWDER_ALARM_HOURS. */
export const POWDER_ALARM_CM = 20;
export const POWDER_ALARM_HOURS = 48;

/**
 * Wind warning: sustained (10 m, daily max) wind at or above this within the next
 * WIND_WARNING_DAYS days, since wind transports snow and builds wind slabs.
 * Gusts are not used: on 3,000 m summits they exceed 60 km/h almost every day, so a gust rule
 * would flag nearly every resort and carry no information.
 */
export const WIND_WARNING_KMH = 40;
export const WIND_WARNING_DAYS = 3;

export const FORECAST_DAYS = 7;
export const PAST_HOURS = 72;
