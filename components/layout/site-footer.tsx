import { useTranslations } from "next-intl";
import { Disclaimer } from "@/components/ui/disclaimer";

export function SiteFooter() {
  const t = useTranslations("Footer");
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-6xl space-y-1 px-4 py-6">
        <Disclaimer />
        <p className="text-sm text-muted">{t("weatherData")}</p>
      </div>
    </footer>
  );
}
