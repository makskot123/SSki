import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GearRanking } from "@/components/gear/gear-ranking";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { routing } from "@/i18n/routing";
import { criteriaFor, MINIMUM_KEYS } from "@/lib/gear";
import { getGearProducts } from "@/lib/gear/data";
import { GEAR_CATEGORIES, gearCategorySchema } from "@/lib/schemas/gear";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    GEAR_CATEGORIES.map((category) => ({ locale, category })),
  );
}

export const dynamicParams = false;

async function categoryOf(params: Promise<{ category: string }>) {
  const parsed = gearCategorySchema.safeParse((await params).category);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/safety/gear/[category]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const category = await categoryOf(params);
  const t = await getTranslations({ locale, namespace: "Gear" });
  return { title: `${t(`categories.${category}.name`)} · ${t("title")}` };
}

export default async function GearCategoryPage({
  params,
}: PageProps<"/[locale]/safety/gear/[category]">) {
  await resolveLocale(params);
  const category = await categoryOf(params);
  const t = await getTranslations("Gear");
  const products = getGearProducts().filter((p) => p.category === category);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link href="/safety/gear" className="text-sm text-accent underline">
          ← {t("back")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {t(`categories.${category}.name`)}
        </h1>
        <p className="max-w-3xl text-muted">
          {t(`categories.${category}.description`)}
        </p>
        <p role="note" className="max-w-3xl text-sm">
          {t("honesty")}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section
          aria-labelledby="minimums-title"
          className="space-y-2 card p-4"
        >
          <h2 id="minimums-title" className="text-lg font-semibold">
            {t("minimumsTitle")}
          </h2>
          <ul className="list-disc pl-5 text-sm">
            {MINIMUM_KEYS[category].map((key) => (
              <li key={key}>{t(`minimums.${key}` as "minimums.digital")}</li>
            ))}
          </ul>
          <p className="text-sm text-muted">{t("minimumsNote")}</p>
        </section>
        <section
          aria-labelledby="criteria-title"
          className="space-y-2 card p-4"
        >
          <h2 id="criteria-title" className="text-lg font-semibold">
            {t("criteriaTitle")}
          </h2>
          <ul className="list-disc pl-5 text-sm">
            {criteriaFor(category).map((key) => (
              <li key={key}>{t(`criteria.${key}` as "criteria.weight")}</li>
            ))}
          </ul>
          <p className="text-sm text-muted">{t("criteriaNote")}</p>
        </section>
      </div>

      <section aria-labelledby="ranking-title" className="space-y-3">
        <h2 id="ranking-title" className="text-2xl font-semibold">
          {t("rankingTitle")}
        </h2>
        <GearRanking
          category={category}
          products={products}
          now={new Date().toISOString()}
        />
      </section>

      <p className="max-w-3xl text-sm">{t("notSubstitute")}</p>
    </div>
  );
}
