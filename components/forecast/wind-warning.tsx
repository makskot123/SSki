import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function WindWarning({ maxWindKmh }: { maxWindKmh: number }) {
  const t = useTranslations("Forecast");
  return (
    <div
      role="note"
      className="space-y-1 rounded-lg border-2 border-fg bg-surface p-3 text-sm"
    >
      <p className="font-semibold">{t("windWarning", { wind: maxWindKmh })}</p>
      <Link href="/avalanche" className="text-accent underline">
        {t("windLink")}
      </Link>
    </div>
  );
}
