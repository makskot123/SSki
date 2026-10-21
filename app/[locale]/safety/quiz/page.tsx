import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Quiz } from "@/components/safety/quiz";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale-param";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/safety/quiz">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Quiz" });
  return { title: t("title") };
}

export default async function QuizPage({
  params,
}: PageProps<"/[locale]/safety/quiz">) {
  await resolveLocale(params);
  const t = await getTranslations("Quiz");
  const ts = await getTranslations("Safety");

  return (
    <div className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link href="/safety" className="text-sm text-accent underline">
          ← {ts("title")}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </header>
      <Quiz />
      <p role="note" className="text-sm text-muted">
        {ts("notSubstitute")}
      </p>
    </div>
  );
}
