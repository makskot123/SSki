import type { Metadata } from "next";
import { getFormatter, getMessages, getTranslations } from "next-intl/server";
import { GearProductCard } from "@/components/gear/product-card";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { buildKit, KIT_KEYS, MINIMUM_KEYS, picksFor } from "@/lib/gear";
import { getGearProducts } from "@/lib/gear/data";
import { GEAR_CATEGORIES } from "@/lib/schemas/gear";

const PICK_KEYS = ["bestPerformance", "bestValue", "budget"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/safety/gear">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Gear" });
  return { title: t("title") };
}

export default async function GearPage({
  params,
}: PageProps<"/[locale]/safety/gear">) {
  await resolveLocale(params);
  const t = await getTranslations("Gear");
  const ts = await getTranslations("Safety");
  const format = await getFormatter();
  const { advice } = (await getMessages()).Gear;
  const products = getGearProducts();
  const now = new Date().toISOString();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <Link href="/safety" className="text-sm text-accent underline">
          ← {ts("title")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-muted">{t("intro")}</p>
        <p role="note" className="max-w-3xl text-sm">
          {t("honesty")}
        </p>
        <p className="max-w-3xl rounded-lg border-2 border-fg bg-surface p-3 font-medium">
          {t("notSubstitute")}
        </p>
      </header>

      <section aria-labelledby="categories-title" className="space-y-4">
        <h2 id="categories-title" className="text-2xl font-semibold">
          {t("categoriesTitle")}
        </h2>
        <ul className="grid gap-4 lg:grid-cols-2">
          {GEAR_CATEGORIES.map((category) => {
            const picks = picksFor(category, products);
            const picked = PICK_KEYS.flatMap((k) =>
              picks[k] ? [{ key: k, product: picks[k] }] : [],
            );
            return (
              <li key={category} className="space-y-3 card p-4">
                <h3 className="text-xl font-semibold">
                  {t(`categories.${category}.name`)}
                </h3>
                <p className="text-sm">
                  {t(`categories.${category}.description`)}
                </p>
                <div>
                  <p className="text-sm font-semibold">{t("minimumsTitle")}</p>
                  <ul className="list-disc pl-5 text-sm">
                    {MINIMUM_KEYS[category].map((key) => (
                      <li key={key}>
                        {t(`minimums.${key}` as "minimums.digital")}
                      </li>
                    ))}
                  </ul>
                </div>
                {picked.length === 0 ? (
                  <p className="text-sm text-muted">{t("noProducts")}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{t("picksTitle")}</p>
                    <ul className="space-y-3">
                      {picked.map(({ key, product }) => (
                        <li key={key} className="space-y-1">
                          <p className="text-sm font-medium text-accent">
                            {t(`picks.${key}`)}
                          </p>
                          <GearProductCard product={product} now={now} />
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted">{t("picksNote")}</p>
                  </div>
                )}
                <p>
                  <Link
                    href={`/safety/gear/${category}`}
                    className="text-sm font-medium text-accent underline"
                  >
                    {t("fullRanking", {
                      category: t(`categories.${category}.name`),
                    })}
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="kits-title" className="space-y-4">
        <h2 id="kits-title" className="text-2xl font-semibold">
          {t("kitsTitle")}
        </h2>
        <ul className="grid gap-4 lg:grid-cols-3">
          {KIT_KEYS.map((key) => {
            const kit = buildKit(key, products);
            return (
              <li
                key={key}
                className="space-y-2 card p-4"
                data-testid={`kit-${key}`}
              >
                <h3 className="text-lg font-semibold">
                  {t(`kits.${key}.name`)}
                </h3>
                <p className="text-sm">{t(`kits.${key}.description`)}</p>
                {kit ? (
                  <>
                    <ul className="list-disc pl-5 text-sm">
                      {kit.items.map((p) => (
                        <li key={p.id}>
                          {t(`categories.${p.category}.short`)}: {p.brand}{" "}
                          {p.model}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm font-semibold">
                      {t("kitTotal", {
                        price: format.number(kit.totalPriceEUR, {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        }),
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted">{t("kitUnavailable")}</p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="max-w-3xl text-sm">{t("notSubstitute")}</p>
      </section>

      <section aria-labelledby="advice-title" className="space-y-3">
        <h2 id="advice-title" className="text-2xl font-semibold">
          {t("adviceTitle")}
        </h2>
        <ul className="max-w-3xl list-disc space-y-1 pl-5">
          {advice.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p className="text-sm font-semibold">{t("adviceSources")}</p>
        <ul className="space-y-1 text-sm">
          {(
            [
              ["https://www.slf.ch/en/avalanches/", "learnSlf"],
              ["https://www.icar.org/", "learnIcar"],
            ] as const
          ).map(([href, key]) => (
            <li key={key}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                {t(key)}
                <span className="sr-only"> {t("opensInNewTab")}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
