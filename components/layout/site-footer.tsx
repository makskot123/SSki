import { useTranslations } from "next-intl";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Disclaimer } from "@/components/ui/disclaimer";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("Footer");
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6">
        <InstallPrompt />
        <Disclaimer />
        <p className="text-sm text-muted">{t("weatherData")}</p>
        <p className="text-sm">
          <Link href="/how-we-rank" className="text-accent underline">
            {t("howWeRank")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
