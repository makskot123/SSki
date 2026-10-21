import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Disclaimer } from "@/components/ui/disclaimer";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import { DEFAULT_WEIGHTS, FACTOR_KEYS } from "@/lib/scoring";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/how-we-rank">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "HowWeRank" });
  return { title: t("title") };
}

export default async function HowWeRankPage({
  params,
}: PageProps<"/[locale]/how-we-rank">) {
  await resolveLocale(params);
  const t = await getTranslations("HowWeRank");
  const tr = await getTranslations("Ranking");
  const limits = t.raw("limits") as string[];

  return (
    <article className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link href="/resorts" className="text-sm text-accent underline">
          ← {t("back")}
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-lg">{t("intro")}</p>
      </header>

      <section aria-labelledby="formula" className="space-y-3">
        <h2 id="formula" className="text-2xl font-semibold">
          {t("formulaTitle")}
        </h2>
        <p className="rounded-lg border border-border bg-surface p-4 font-mono text-sm">
          {t("formula")}
        </p>
        <p>{t("formulaBody")}</p>
      </section>

      <section aria-labelledby="factors" className="space-y-3">
        <h2 id="factors" className="text-2xl font-semibold">
          {t("factorsTitle")}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {t("colFactor")}
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {t("colMeasure")}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">
                  {t("colWeight")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FACTOR_KEYS.map((key) => (
                <tr key={key}>
                  <th scope="row" className="px-4 py-2 align-top font-medium">
                    {tr(`factors.${key}`)}
                  </th>
                  <td className="px-4 py-2 align-top">
                    {t(`measures.${key}`)}
                  </td>
                  <td className="px-4 py-2 text-right align-top">
                    {DEFAULT_WEIGHTS[key]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="missing" className="space-y-2">
        <h2 id="missing" className="text-2xl font-semibold">
          {t("missingTitle")}
        </h2>
        <p>{t("missingBody")}</p>
      </section>

      <section aria-labelledby="safety" className="space-y-2">
        <h2 id="safety" className="text-2xl font-semibold">
          {t("safetyTitle")}
        </h2>
        <p>{t("safetyBody")}</p>
        <Disclaimer />
      </section>

      <section aria-labelledby="limits" className="space-y-2">
        <h2 id="limits" className="text-2xl font-semibold">
          {t("limitsTitle")}
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          {limits.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
