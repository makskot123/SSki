/** Localised country name from an ISO 3166-1 alpha-2 code; falls back to the code. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "MM-DD" (as used for season dates) as a UTC date in a fixed non-leap year, for locale formatting. */
export function monthDayDate(value: string): Date {
  const [month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(2001, month - 1, day));
}
