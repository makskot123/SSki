import type { Metadata } from "next";
import { FavouriteButton } from "@/components/favourites/favourite-button";
import { ConditionNotes } from "@/components/resort/condition-notes";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForecastSection } from "@/components/forecast/forecast-section";
import { ResortAvalancheMap } from "@/components/resort/resort-avalanche-map";
import {
  ResortAvalancheSection,
  type OfficialLink,
} from "@/components/resort/resort-avalanche-section";
import { ResortFacts } from "@/components/resort/resort-facts";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { routing } from "@/i18n/routing";
import { countryName } from "@/lib/format";
import { getResortBySlug, getResorts } from "@/lib/resorts";
import { getAvalancheData } from "@/lib/avalanche";
import { regionLabel, regionMeta, servicesFor } from "@/lib/avalanche/meta";
import { PROVIDERS } from "@/lib/avalanche/providers";
import { resortAvalanche } from "@/lib/avalanche/resort-status";
import { getForecasts } from "@/lib/weather";

export const dynamicParams = false;
// Forecasts are cached for an hour, bulletins for 15 minutes; the page follows the shorter one.
export const revalidate = 900;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getResorts().map((r) => ({ locale, slug: r.slug })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/resorts/[slug]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const resort = getResortBySlug(slug);
  if (!resort) return {};
  return { title: resort.name, description: resort.description[locale] };
}

export default async function ResortPage({
  params,
}: PageProps<"/[locale]/resorts/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const resort = getResortBySlug(slug);
  if (!resort) notFound();

  const t = await getTranslations("ResortDetail");
  const newTab = t("opensInNewTab");
  const { bySlug } = await getForecasts();
  const forecast = bySlug[resort.slug];

  const now = new Date();
  const { index, feeds } = await getAvalancheData(now);
  const avalanche = resortAvalanche(resort, index, feeds, (id) =>
    regionLabel(
      regionMeta,
      id,
      locale,
      index.get(id)?.bulletin.regionNames[id],
    ),
  );

  // Official sources for the resort's regions (EAWS metadata) plus the resort's own bulletin link.
  const links: OfficialLink[] = [];
  const addLink = (name: string, url: string) => {
    if (!links.some((l) => l.url === url)) links.push({ name, url });
  };
  for (const id of resort.avalancheRegionIds) {
    for (const s of servicesFor(regionMeta, id)) addLink(s.name, s.url);
  }
  if (resort.links.avalancheBulletin) {
    addLink(t("avalancheBulletin"), resort.links.avalancheBulletin);
  }

  return (
    <article className="space-y-8">
      <div className="space-y-3">
        <Link href="/resorts" className="text-sm text-accent underline">
          ← {t("back")}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-4xl font-bold tracking-tight">{resort.name}</h1>
          <FavouriteButton
            slug={resort.slug}
            name={resort.name}
            className="mt-1 shrink-0"
          />
        </div>
        <p className="text-muted">
          {resort.region}, {countryName(resort.country, locale)}
        </p>
        <p className="max-w-3xl text-lg">{resort.description[locale]}</p>
        <p>
          <Link
            href={`/compare?r=${resort.slug}`}
            className="text-sm font-medium text-accent underline"
          >
            {t("compareWith")}
          </Link>
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="facts" className="space-y-3">
          <h2 id="facts" className="text-xl font-semibold">
            {t("keyFacts")}
          </h2>
          <ResortFacts resort={resort} />
          <p role="note" className="text-sm text-muted">
            {t("approxNote")}
          </p>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="zones" className="space-y-3">
            <h2 id="zones" className="text-xl font-semibold">
              {t("freerideZones")}
            </h2>
            {resort.offPiste.freerideZones.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {resort.offPiste.freerideZones.map((z) => (
                  <li
                    key={z.name}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-sm"
                  >
                    {z.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">{t("noZones")}</p>
            )}
          </section>

          <section aria-labelledby="links" className="space-y-3">
            <h2 id="links" className="text-xl font-semibold">
              {t("links")}
            </h2>
            <ul className="space-y-2">
              <li>
                <a
                  href={resort.links.official}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  {t("officialSite")} <span className="sr-only">{newTab}</span>
                </a>
              </li>
              {/* Link-outs only: webcam images are never embedded or hotlinked. */}
              {resort.links.webcams?.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    {t("webcams")} <span className="sr-only">{newTab}</span>
                  </a>
                </li>
              ))}
              <li>
                {resort.links.avalancheBulletin ? (
                  <a
                    href={resort.links.avalancheBulletin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    {t("avalancheBulletin")}{" "}
                    <span className="sr-only">{newTab}</span>
                  </a>
                ) : (
                  <p className="text-muted">{t("noBulletin")}</p>
                )}
              </li>
            </ul>
          </section>
        </div>
      </div>

      <ForecastSection
        forecast={forecast}
        resortName={resort.name}
        avalancheAnchor="avalanche"
      />

      {avalanche.kind === "no_service" ? (
        <ResortAvalancheSection kind="no_service" />
      ) : avalanche.kind === "not_covered" ? (
        <>
          <ResortAvalancheSection kind="not_covered" links={links} />
          <ResortAvalancheMap
            resortName={resort.name}
            position={resort.coordinates}
            regionIds={resort.avalancheRegionIds}
            regions={[]}
            renderedAt={now.toISOString()}
          />
        </>
      ) : (
        <>
          <ResortAvalancheSection
            kind="covered"
            regions={avalanche.regions}
            feedsDown={avalanche.feedsDown.map((id) => PROVIDERS[id].name)}
            links={links}
            renderedAt={now.toISOString()}
          />
          <ResortAvalancheMap
            resortName={resort.name}
            position={resort.coordinates}
            regionIds={resort.avalancheRegionIds}
            regions={avalanche.regions}
            renderedAt={now.toISOString()}
          />
        </>
      )}
      <ConditionNotes slug={resort.slug} />
    </article>
  );
}
