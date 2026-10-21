import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** `anchor`: id of a section on the same page (e.g. the resort's avalanche section); otherwise links to the map. */
export function WindWarning({
  maxWindKmh,
  anchor,
}: {
  maxWindKmh: number;
  anchor?: string;
}) {
  const t = useTranslations("Forecast");
  return (
    <div
      role="note"
      className="space-y-1 rounded-lg border-2 border-fg bg-surface p-3 text-sm"
    >
      <p className="font-semibold">{t("windWarning", { wind: maxWindKmh })}</p>
      {anchor ? (
        <a href={`#${anchor}`} className="text-accent underline">
          {t("windLinkHere")}
        </a>
      ) : (
        <Link href="/avalanche" className="text-accent underline">
          {t("windLink")}
        </Link>
      )}
    </div>
  );
}
