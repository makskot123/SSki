import type { Metadata } from "next";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { DataStatusTag } from "@/components/forecast/data-status-tag";
import {
  PlannerResults,
  type PlannerRow,
} from "@/components/planner/planner-results";
import { Disclaimer } from "@/components/ui/disclaimer";
import { PrintButton } from "@/components/ui/print-button";
import { resolveLocale } from "@/i18n/locale-param";
import { getAvalancheData } from "@/lib/avalanche";
import { regionLabel, regionMeta } from "@/lib/avalanche/meta";
import { resortAvalanche } from "@/lib/avalanche/resort-status";
import { countryName } from "@/lib/format";
import {
  coverage,
  isoDay,
  MAX_TRIP_DAYS,
  parsePlannerQuery,
  planScores,
  SNOW_SHARE,
  tripDates,
} from "@/lib/planner";
import { getResorts } from "@/lib/resorts";
import { CHECKLIST_GROUPS } from "@/lib/safety/checklist";
import { DEFAULT_WEIGHTS, scoreResorts } from "@/lib/scoring";
import { getForecasts } from "@/lib/weather";
import { snowOnDates } from "@/lib/weather/map";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/planner">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Planner" });
  return { title: t("title") };
}

export default async function PlannerPage({
  params,
  searchParams,
}: PageProps<"/[locale]/planner">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Planner");
  const format = await getFormatter();
  const checklist = (await getMessages()).Checklist;

  const now = new Date();
  const resorts = getResorts();
  const countries = [...new Set(resorts.map((r) => r.country))].sort((a, b) =>
    countryName(a, locale).localeCompare(countryName(b, locale), locale),
  );
  const query = parsePlannerQuery(await searchParams, isoDay(now), countries);
  const days = tripDates(query.from, query.to);

  const [{ bySlug, status }, { index, feeds }] = await Promise.all([
    getForecasts(now),
    getAvalancheData(now),
  ]);
  const live = status === "live";
  const forecastDays = Object.values(bySlug)[0]?.days.map((d) => d.date) ?? [];
  const cover = coverage(days, forecastDays);
  // Sample data never feeds the ranking; neither do days the forecast does not reach.
  const snowUsable = live && cover.kind !== "none";

  const candidates = query.country
    ? resorts.filter((r) => r.country === query.country)
    : resorts;
  // Resort scores are computed over all resorts, so a country filter does not change anyone's score.
  const base = new Map(
    scoreResorts(resorts, DEFAULT_WEIGHTS).map((s) => [s.resort.slug, s.score]),
  );
  const scored = planScores(
    candidates.map((r) => ({
      slug: r.slug,
      baseScore: base.get(r.slug) ?? 0,
      tripSnowCm: snowUsable ? snowOnDates(bySlug[r.slug], days).cm : null,
    })),
  );
  const bySlugResort = new Map(candidates.map((r) => [r.slug, r]));
  const rows: PlannerRow[] = scored.map((row) => {
    const resort = bySlugResort.get(row.slug)!;
    return {
      ...row,
      name: resort.name,
      place: `${resort.region}, ${countryName(resort.country, locale)}`,
      avalanche: resortAvalanche(resort, index, feeds, (id) =>
        regionLabel(
          regionMeta,
          id,
          locale,
          index.get(id)?.bulletin.regionNames[id],
        ),
      ),
    };
  });

  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  // Dates beyond the forecast are always said plainly, even when the forecast is sample data.
  const forecastNote =
    cover.kind === "none"
      ? t("forecastNone")
      : !live
        ? t("forecastSample")
        : cover.kind === "full"
          ? t("forecastFull")
          : t("forecastPartial", {
              covered: cover.covered,
              total: cover.total,
            });

  const field =
    "rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-muted print:hidden">{t("intro")}</p>
      </header>

      {/* A plain GET form: works without JavaScript, and the result is a shareable link. */}
      <form
        method="get"
        className="flex flex-wrap items-end gap-4 card p-4 print:hidden"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("from")}
          <input
            type="date"
            name="from"
            defaultValue={query.from}
            min={isoDay(now)}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("to")}
          <input
            type="date"
            name="to"
            defaultValue={query.to}
            min={isoDay(now)}
            required
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t("country")}
          <select
            name="country"
            defaultValue={query.country ?? "all"}
            className={field}
          >
            <option value="all">{t("allCountries")}</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {countryName(c, locale)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:opacity-90"
        >
          {t("submit")}
        </button>
      </form>

      <section aria-labelledby="shortlist" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="shortlist" className="text-2xl font-semibold">
            {t("range", { from: day(query.from), to: day(query.to) })}
            {query.country && ` · ${countryName(query.country, locale)}`}
          </h2>
          <PrintButton label={t("print")} />
        </div>
        {query.adjusted && (
          <p role="status" className="text-sm font-medium">
            {t("adjusted", { max: MAX_TRIP_DAYS })}
          </p>
        )}
        <div className="space-y-2" data-testid="forecast-note">
          <DataStatusTag
            status={status}
            generatedAt={Object.values(bySlug)[0]?.generatedAt}
          />
          <p className="max-w-3xl text-sm">{forecastNote}</p>
          <p className="max-w-3xl text-sm text-muted">
            {snowUsable
              ? t("howRanked", {
                  snowShare: SNOW_SHARE * 100,
                  baseShare: (1 - SNOW_SHARE) * 100,
                })
              : t("howRanked", { snowShare: 0, baseShare: 100 })}
          </p>
          <p className="max-w-3xl text-sm text-muted">
            {t("avalancheNowNote")}
          </p>
        </div>

        <PlannerResults
          rows={rows}
          renderedAt={now.toISOString()}
          partial={
            snowUsable && cover.kind === "partial" ? cover.covered : undefined
          }
        />
        <Disclaimer />
      </section>

      {/* Printed with the plan: a blank copy of the checklist to tick on paper. */}
      <section className="hidden space-y-3 print:block">
        <h2 className="text-xl font-semibold">{t("printChecklistTitle")}</h2>
        <p className="text-sm">{t("printChecklistNote")}</p>
        {CHECKLIST_GROUPS.map((group) => (
          <div key={group.id} className="break-inside-avoid">
            <h3 className="font-semibold">{checklist.groups[group.id]}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-block h-4 w-4 shrink-0 border border-fg"
                  />
                  {
                    checklist.items[item.id as keyof typeof checklist.items]
                      .label
                  }
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
