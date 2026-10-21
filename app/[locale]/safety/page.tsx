import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DangerBadge } from "@/components/avalanche/danger-badge";
import { Disclaimer } from "@/components/ui/disclaimer";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";
import type { DangerLevel } from "@/lib/schemas/avalanche";

const TOOLS = [
  { key: "checklist", href: "/safety/checklist" },
  { key: "aspects", href: "/safety/aspects" },
  { key: "quiz", href: "/safety/quiz" },
] as const;

const LEVELS: DangerLevel[] = [1, 2, 3, 4, 5];

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/safety">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Safety" });
  return { title: t("title") };
}

export default async function SafetyPage({
  params,
}: PageProps<"/[locale]/safety">) {
  await resolveLocale(params);
  const t = await getTranslations("Safety");

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-3xl text-muted">{t("intro")}</p>
        <div className="max-w-3xl rounded-lg border-2 border-fg bg-surface p-3 font-medium">
          <Disclaimer className="text-fg!" />
        </div>
      </header>

      <ul className="grid gap-4 md:grid-cols-3">
        {TOOLS.map(({ key, href }) => (
          <li key={key}>
            <Link
              href={href}
              className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:border-accent"
            >
              <span className="text-lg font-semibold">
                {t(`tools.${key}.title`)}
              </span>
              <span className="text-sm text-muted">
                {t(`tools.${key}.body`)}
              </span>
              <span className="mt-auto pt-2 text-sm font-medium text-accent underline">
                {t("open")}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="danger-title" className="space-y-3">
        <h2 id="danger-title" className="text-2xl font-semibold">
          {t("dangerTitle")}
        </h2>
        <p className="max-w-3xl text-muted">{t("dangerIntro")}</p>
        <ol className="max-w-3xl space-y-2">
          {LEVELS.map((level) => (
            <li
              key={level}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <span className="w-44 shrink-0">
                <DangerBadge level={level} />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                {t(`dangerMeaning.${level}`)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="learn-title" className="space-y-3">
        <h2 id="learn-title" className="text-2xl font-semibold">
          {t("learnTitle")}
        </h2>
        <p className="max-w-3xl">{t("learnBody")}</p>
        <ul className="space-y-1">
          <li>
            <a
              href="https://www.slf.ch/en/avalanches/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              {t("learnSlf")}
              <span className="sr-only"> {t("opensInNewTab")}</span>
            </a>
          </li>
          <li>
            <a
              href="https://www.icar.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              {t("learnIcar")}
              <span className="sr-only"> {t("opensInNewTab")}</span>
            </a>
          </li>
        </ul>
      </section>

      <p role="note" className="max-w-3xl text-sm text-muted">
        {t("notSubstitute")}
      </p>
    </div>
  );
}
