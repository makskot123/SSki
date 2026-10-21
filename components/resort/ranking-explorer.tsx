"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { ResortCard } from "@/components/resort/resort-card";
import { applyFilters, type Filters } from "@/lib/filters";
import { countryName } from "@/lib/format";
import {
  DEFAULT_STATE,
  serialiseRankingQuery,
  type RankingState,
} from "@/lib/ranking-query";
import { aspectSchema, type Resort } from "@/lib/schemas/resort";
import {
  FACTOR_KEYS,
  MAX_WEIGHT,
  type Conditions,
  PRESET_KEYS,
  PRESETS,
  scoreResorts,
  type FactorKey,
  type Weights,
} from "@/lib/scoring";

const PRICE_OPTIONS = [40, 50, 60, 70, 80] as const;
const TOP_OPTIONS = [2000, 2500, 3000, 3500] as const;
const ASPECTS = aspectSchema.options;

const sameWeights = (a: Weights, b: Weights) =>
  FACTOR_KEYS.every((k) => a[k] === b[k]);

const inputClass =
  "rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg";

export function RankingExplorer({
  resorts,
  initial,
  conditions,
  alarmSlugs,
}: {
  resorts: Resort[];
  initial: RankingState;
  /** Fresh snow (cm, last 72 h) per slug; undefined when live data is unavailable. */
  conditions?: Conditions;
  /** Resorts with a live Powder Alarm. */
  alarmSlugs: string[];
}) {
  const t = useTranslations("Ranking");
  const locale = useLocale();
  const format = useFormatter();
  const [state, setState] = useState<RankingState>(initial);
  const [panelOpen, setPanelOpen] = useState(false);
  const { weights, filters } = state;

  // Keep the URL shareable without triggering a navigation or server re-render.
  useEffect(() => {
    const qs = serialiseRankingQuery(state).toString();
    const url =
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState(window.history.state, "", url);
  }, [state]);

  const scored = useMemo(
    () => scoreResorts(resorts, weights, conditions),
    [resorts, weights, conditions],
  );
  const visible = useMemo(
    () => scored.filter((s) => applyFilters(s.resort, filters)),
    [scored, filters],
  );
  const countries = useMemo(
    () =>
      [...new Set(resorts.map((r) => r.country))].sort((a, b) =>
        countryName(a, locale).localeCompare(countryName(b, locale), locale),
      ),
    [resorts, locale],
  );

  const setWeight = (key: FactorKey, value: number) =>
    setState((s) => ({ ...s, weights: { ...s.weights, [key]: value } }));
  const setFilters = (patch: Partial<Filters>) =>
    setState((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
  const toggle = <T,>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const allZero = FACTOR_KEYS.every((k) => weights[k] === 0);
  const eur = (n: number) =>
    format.number(n, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="lg:sticky lg:top-4 lg:self-start">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          aria-controls="ranking-panel"
          className="w-full rounded-md border border-border bg-surface px-4 py-2 text-left font-medium lg:hidden"
        >
          {t("panelToggle")}
        </button>

        <div
          id="ranking-panel"
          className={`${panelOpen ? "block" : "hidden"} mt-3 space-y-6 rounded-lg border border-border bg-surface p-4 lg:mt-0 lg:block`}
        >
          <section aria-labelledby="presets-title" className="space-y-2">
            <h2 id="presets-title" className="text-sm font-semibold">
              {t("presetsTitle")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {PRESET_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sameWeights(weights, PRESETS[key])}
                  onClick={() =>
                    setState((s) => ({ ...s, weights: { ...PRESETS[key] } }))
                  }
                  className="rounded-full border border-border px-3 py-1 text-sm hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-fg"
                >
                  {t(`presets.${key}`)}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="priorities-title" className="space-y-3">
            <div>
              <h2 id="priorities-title" className="text-sm font-semibold">
                {t("prioritiesTitle")}
              </h2>
              <p className="text-xs text-muted">{t("prioritiesHelp")}</p>
            </div>
            {FACTOR_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <label htmlFor={`w-${key}`}>{t(`factors.${key}`)}</label>
                  <output htmlFor={`w-${key}`} className="font-medium">
                    {weights[key]}
                  </output>
                </div>
                <input
                  id={`w-${key}`}
                  type="range"
                  min={0}
                  max={MAX_WEIGHT}
                  step={1}
                  value={weights[key]}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            ))}
            {!conditions && (
              <p role="note" className="text-xs text-muted">
                {t("conditionsUnavailable")}
              </p>
            )}
          </section>

          <section aria-labelledby="filters-title" className="space-y-4">
            <h2 id="filters-title" className="text-sm font-semibold">
              {t("filtersTitle")}
            </h2>

            <fieldset className="space-y-1">
              <legend className="text-sm">{t("country")}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {countries.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.countries.includes(c)}
                      onChange={() =>
                        setFilters({ countries: toggle(filters.countries, c) })
                      }
                      className="accent-accent"
                    />
                    {countryName(c, locale)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-2 text-sm">
              <label htmlFor="f-price">{t("maxPrice")}</label>
              <select
                id="f-price"
                className={inputClass}
                value={filters.maxPrice ?? ""}
                onChange={(e) =>
                  setFilters({
                    maxPrice: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">{t("anyValue")}</option>
                {PRICE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {eur(p)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
              <label htmlFor="f-top">{t("minTop")}</label>
              <select
                id="f-top"
                className={inputClass}
                value={filters.minTop ?? ""}
                onChange={(e) =>
                  setFilters({
                    minTop: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">{t("anyValue")}</option>
                {TOP_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {format.number(m)} m
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-1">
              <legend className="text-sm">{t("aspect")}</legend>
              <div className="flex flex-wrap gap-2">
                {ASPECTS.map((a) => (
                  <label
                    key={a}
                    className="cursor-pointer rounded-md border border-border px-2.5 py-1 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-fg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filters.aspects.includes(a)}
                      onChange={() =>
                        setFilters({ aspects: toggle(filters.aspects, a) })
                      }
                    />
                    {a}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.guides}
                  onChange={(e) => setFilters({ guides: e.target.checked })}
                  className="accent-accent"
                />
                {t("guides")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.beginner}
                  onChange={(e) => setFilters({ beginner: e.target.checked })}
                  className="accent-accent"
                />
                {t("beginner")}
              </label>
            </div>
          </section>

          <button
            type="button"
            onClick={() => setState(DEFAULT_STATE)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm hover:border-accent"
          >
            {t("reset")}
          </button>
        </div>
      </div>

      <div>
        <p aria-live="polite" className="mb-3 text-sm text-muted">
          {t("results", { count: visible.length, total: resorts.length })}
        </p>
        {allZero && (
          <p role="note" className="mb-3 text-sm text-muted">
            {t("allZero")}
          </p>
        )}
        {visible.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-4">
            {t("noResults")}
          </p>
        ) : (
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((s, i) => (
              <li key={s.resort.slug}>
                <ResortCard
                  resort={s.resort}
                  rank={i + 1}
                  score={Math.round(s.score)}
                  freshSnowCm={conditions?.[s.resort.slug]}
                  powderAlarm={alarmSlugs.includes(s.resort.slug)}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
