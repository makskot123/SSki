import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AspectExplorer } from "@/components/safety/aspect-explorer";
import { SteepnessGuide } from "@/components/safety/steepness-guide";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/safety/aspects">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Aspects" });
  return { title: t("title") };
}

export default async function AspectsPage({
  params,
}: PageProps<"/[locale]/safety/aspects">) {
  await resolveLocale(params);
  const t = await getTranslations("Aspects");
  const ts = await getTranslations("Safety");
  const why = t.raw("whyBody") as string[];

  return (
    <div className="max-w-4xl space-y-12">
      <header className="space-y-3">
        <Link href="/safety" className="text-sm text-accent underline">
          ← {ts("title")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-lg">{t("intro")}</p>
      </header>

      <section aria-labelledby="aspect-title" className="space-y-4">
        <div className="space-y-1">
          <h2 id="aspect-title" className="text-2xl font-semibold">
            {t("aspectTitle")}
          </h2>
          <p className="max-w-3xl text-muted">{t("aspectHelp")}</p>
        </div>
        <AspectExplorer />
      </section>

      <section aria-labelledby="steep-title" className="space-y-4">
        <div className="space-y-1">
          <h2 id="steep-title" className="text-2xl font-semibold">
            {t("steepnessTitle")}
          </h2>
          <p className="max-w-3xl text-muted">{t("steepnessHelp")}</p>
        </div>
        <SteepnessGuide />
      </section>

      <section aria-labelledby="why-title" className="max-w-3xl space-y-3">
        <h2 id="why-title" className="text-2xl font-semibold">
          {t("whyTitle")}
        </h2>
        <ol className="list-decimal space-y-2 pl-6">
          {why.map((paragraph) => (
            <li key={paragraph}>{paragraph}</li>
          ))}
        </ol>
        <p role="note" className="card p-3 text-sm">
          {t("whyNote")}
        </p>
      </section>

      <section aria-labelledby="measure-title" className="max-w-3xl space-y-2">
        <h2 id="measure-title" className="text-2xl font-semibold">
          {t("measureTitle")}
        </h2>
        <p>{t("measureBody")}</p>
      </section>

      <section aria-labelledby="bulletin-title" className="max-w-3xl space-y-2">
        <h2 id="bulletin-title" className="text-2xl font-semibold">
          {t("bulletinTitle")}
        </h2>
        <p>{t("bulletinBody")}</p>
        <Link href="/avalanche" className="font-medium text-accent underline">
          {t("bulletinLink")}
        </Link>
      </section>

      <p role="note" className="max-w-3xl text-sm text-muted">
        {ts("notSubstitute")}
      </p>
    </div>
  );
}
