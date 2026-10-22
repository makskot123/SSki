import { getTranslations } from "next-intl/server";
import { Hero } from "@/components/home/hero";
import { MyResorts, type HomeResort } from "@/components/home/my-resorts";
import { QuickTiles } from "@/components/home/quick-tiles";
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

  const tiles = (
    [
      ["/avalanche", "avalanche"],
      ["/powder", "powder"],
      ["/planner", "planner"],
      ["/track", "track"],
      ["/resorts", "resorts"],
      ["/safety", "safety"],
    ] as const
  ).map(([href, key]) => ({
    href,
    icon: key,
    title: t(`tiles.${key}.title`),
    body: t(`tiles.${key}.body`),
  }));

  return (
    <div className="space-y-10">
      <Hero
        title={t("title")}
        subtitle={t("subtitle")}
        primary={{ href: "/planner", label: t("planTrip") }}
        secondary={{ href: "/avalanche", label: t("openAvalanche") }}
      />
      <QuickTiles tiles={tiles} label={t("tilesLabel")} />
      <MyResorts resorts={resorts} renderedAt={now.toISOString()} />
    </div>
  );
}
