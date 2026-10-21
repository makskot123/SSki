import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <Link href="/" className="text-accent underline">
        {t("back")}
      </Link>
    </section>
  );
}
