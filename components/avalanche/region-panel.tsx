"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AspectRose } from "@/components/avalanche/aspect-rose";
import { DangerBadge } from "@/components/avalanche/danger-badge";
import { Disclaimer } from "@/components/ui/disclaimer";
import {
  bulletinFor,
  describeElevation,
  type AvalancheView,
} from "@/lib/avalanche/view";
import type {
  AvalancheBulletin,
  ElevationBand,
  ElevationBound,
} from "@/lib/schemas/avalanche";

export type { RegionMeta } from "@/lib/avalanche/meta";
import type { RegionMeta } from "@/lib/avalanche/meta";

const DISPLAY_ZONE = "Europe/Vienna"; // fixed so server and browser render the same text

/**
 * English: the provider's own English name, then EAWS (whose "English" names are often untranslated
 * local names). Polish: EAWS's Polish name, then the provider's English name.
 */
export function regionName(
  id: string,
  view: AvalancheView,
  meta: RegionMeta | null,
  locale: string,
): string {
  const fromBulletin = bulletinFor(view, id)?.regionNames[id];
  const fromMeta = meta?.regions[id]?.n[locale === "pl" ? 1 : 0];
  return (
    (locale === "pl"
      ? (fromMeta ?? fromBulletin)
      : (fromBulletin ?? fromMeta)) ?? id
  );
}

export function RegionPanel({
  regionId,
  view,
  meta,
}: {
  regionId: string | null;
  view: AvalancheView;
  meta: RegionMeta | null;
}) {
  const t = useTranslations("Avalanche");
  const locale = useLocale();
  const format = useFormatter();

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: DISPLAY_ZONE,
      timeZoneName: "short",
    });
  const bound = (b: ElevationBound) =>
    b === "treeline"
      ? t("elevation.treeline")
      : t("elevation.metres", { value: format.number(b) });
  const elevation = (band: ElevationBand | undefined) => {
    const d = describeElevation(band);
    switch (d.kind) {
      case "all":
        return t("elevation.all");
      case "above":
        return t("elevation.above", { bound: bound(d.bound) });
      case "below":
        return t("elevation.below", { bound: bound(d.bound) });
      case "between":
        return t("elevation.between", {
          lower: bound(d.lower),
          upper: bound(d.upper),
        });
    }
  };

  return (
    <section
      aria-labelledby="panel-title"
      aria-live="polite"
      className="space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <h2 id="panel-title" className="text-lg font-semibold">
        {t("panelTitle")}
      </h2>
      {regionId === null ? (
        <p className="text-muted">{t("panelEmpty")}</p>
      ) : (
        <PanelBody
          regionId={regionId}
          view={view}
          meta={meta}
          locale={locale}
          when={when}
          elevation={elevation}
        />
      )}
    </section>
  );
}

function PanelBody({
  regionId,
  view,
  meta,
  locale,
  when,
  elevation,
}: {
  regionId: string;
  view: AvalancheView;
  meta: RegionMeta | null;
  locale: string;
  when: (iso: string) => string;
  elevation: (band: ElevationBand | undefined) => string;
}) {
  const t = useTranslations("Avalanche");
  const entry = view.regions[regionId];
  const bulletin = bulletinFor(view, regionId);
  const name = regionName(regionId, view, meta, locale);
  const services = meta?.services[meta.regions[regionId]?.o ?? ""] ?? [];

  const heading = (
    <div>
      <h3 className="text-xl font-bold">{name}</h3>
      <p className="text-xs text-muted">{regionId}</p>
    </div>
  );

  // Out-of-date or missing: say so plainly. No level, no colour, only the way to the official source.
  if (!entry || !bulletin || entry.state === "stale") {
    return (
      <div className="space-y-3">
        {heading}
        <p className="font-semibold">{t("staleTitle")}</p>
        <p className="text-sm">
          {entry && bulletin
            ? t("staleBody", { time: when(bulletin.publicationTime) })
            : t("noneBody")}
        </p>
        <OfficialLinks
          services={services}
          loading={meta === null}
          bulletin={bulletin}
        />
        <Disclaimer />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {heading}
      <CurrentBulletin bulletin={bulletin} when={when} elevation={elevation} />
      <OfficialLinks services={services} loading={false} bulletin={bulletin} />
      <Disclaimer />
    </div>
  );
}

function CurrentBulletin({
  bulletin,
  when,
  elevation,
}: {
  bulletin: AvalancheBulletin;
  when: (iso: string) => string;
  elevation: (band: ElevationBand | undefined) => string;
}) {
  const t = useTranslations("Avalanche");
  return (
    <>
      <div className="space-y-1">
        <p className="text-sm text-muted">{t("maxDanger")}</p>
        {bulletin.maxDangerLevel ? (
          <DangerBadge level={bulletin.maxDangerLevel} large />
        ) : (
          <p className="font-semibold">{t("noRating")}</p>
        )}
      </div>

      <section aria-labelledby="ratings-title" className="space-y-2">
        <h4 id="ratings-title" className="text-sm font-semibold">
          {t("ratingsTitle")}
        </h4>
        <ul className="space-y-2">
          {bulletin.dangerRatings.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              {r.level ? (
                <DangerBadge level={r.level} />
              ) : (
                <span className="font-medium">{t("noRating")}</span>
              )}
              <span>{elevation(r.elevation)}</span>
              <span className="text-muted">
                · {t(`periods.${r.validTimePeriod}`)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="problems-title" className="space-y-2">
        <h4 id="problems-title" className="text-sm font-semibold">
          {t("problemsTitle")}
        </h4>
        {bulletin.problems.length === 0 ? (
          <p className="text-sm text-muted">{t("noProblems")}</p>
        ) : (
          <ul className="space-y-3">
            {bulletin.problems.map((p, i) => (
              <li key={i} className="flex items-center gap-3">
                <AspectRose aspects={p.aspects} />
                <div className="text-sm">
                  <p className="font-medium">{t(`problems.${p.type}`)}</p>
                  <p>{elevation(p.elevation)}</p>
                  <p className="text-muted">
                    {t(`periods.${p.validTimePeriod}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {bulletin.highlights && (
        <section className="space-y-1">
          <h4 className="text-sm font-semibold">{t("providerSummary")}</h4>
          <p className="text-sm" lang="en">
            {bulletin.highlights}
          </p>
        </section>
      )}

      <ul className="space-y-0.5 text-xs text-muted">
        <li>{t("published", { time: when(bulletin.publicationTime) })}</li>
        <li>{t("validUntil", { time: when(bulletin.validUntil) })}</li>
        <li>
          {t("source", {
            provider: bulletin.provider.name,
            license: bulletin.provider.license,
          })}
        </li>
      </ul>
    </>
  );
}

function OfficialLinks({
  services,
  loading,
  bulletin,
}: {
  services: { name: string; url: string }[];
  loading: boolean;
  bulletin: AvalancheBulletin | undefined;
}) {
  const t = useTranslations("Avalanche");
  return (
    <div className="space-y-1 text-sm">
      {bulletin && (
        <p>
          <a
            href={bulletin.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline"
          >
            {t("readFull")}
          </a>
        </p>
      )}
      {services.length > 0 && (
        <div>
          <p className="text-muted">{t("officialService")}</p>
          <ul>
            {services.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {loading && <p className="text-muted">{t("metaLoading")}</p>}
    </div>
  );
}
