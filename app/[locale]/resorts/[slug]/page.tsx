import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ResortFacts } from "@/components/resort/resort-facts";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { routing } from "@/i18n/routing";
import { countryName } from "@/lib/format";
import { getResortBySlug, getResorts } from "@/lib/resorts";

export const dynamicParams = false;

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

  return (
    <article className="space-y-8">
      <div className="space-y-3">
        <Link href="/resorts" className="text-sm text-accent underline">
          ← {t("back")}
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">{resort.name}</h1>
        <p className="text-muted">
          {resort.region}, {countryName(resort.country, locale)}
        </p>
        <p className="max-w-3xl text-lg">{resort.description[locale]}</p>
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
    </article>
  );
}
