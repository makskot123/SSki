import { useTranslations } from "next-intl";

export function Disclaimer({ className = "" }: { className?: string }) {
  const t = useTranslations("Footer");
  return (
    <p role="note" className={`text-sm text-muted ${className}`}>
      {t("disclaimer")}
    </p>
  );
}
