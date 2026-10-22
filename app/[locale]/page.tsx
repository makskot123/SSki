import { getTranslations } from "next-intl/server";
import { MyResorts, type HomeResort } from "@/components/home/my-resorts";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { getAvalancheData } from "@/lib/avalanche";
import { regionLabel, regionMeta } from "@/lib/avalanche/meta";
import { resortAvalanche } from "@/lib/avalanche/resort-status";
import { countryName } from "@/lib/format";
import { getResorts } from "@/lib/resorts";

// Bulletins change during the day; same cache time as the avalanche page.
export const revalidate = 900;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Home");

  const now = new Date();
  const { index, feeds } = await getAvalancheData(now);
  const resorts: HomeResort[] = getResorts().map((resort) => ({
    slug: resort.slug,
    name: resort.name,
    place: `${resort.region}, ${countryName(resort.country, locale)}`,
    coordinates: resort.coordinates,
    avalanche: resortAvalanche(resort, index, feeds, (id) =>
      regionLabel(
        regionMeta,
        id,
        locale,
        index.get(id)?.bulletin.regionNames[id],
      ),
    ),
  }));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-lg text-muted">{t("subtitle")}</p>
        <p className="flex flex-wrap gap-3">
          <Link
            href="/planner"
            className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg"
          >
            {t("planTrip")}
          </Link>
          <Link
            href="/avalanche"
            className="rounded-md border border-border bg-surface px-4 py-2 font-medium hover:border-accent"
          >
            {t("openAvalanche")}
          </Link>
        </p>
      </section>
      <MyResorts resorts={resorts} renderedAt={now.toISOString()} />
    </div>
  );
}
