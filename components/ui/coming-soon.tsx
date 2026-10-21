import { useTranslations } from "next-intl";

export function ComingSoon({ title }: { title: string }) {
  const t = useTranslations("Placeholder");
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted">
        {t("title")}. {t("body")}
      </p>
    </div>
  );
}
