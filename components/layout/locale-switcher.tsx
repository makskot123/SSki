"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("Locale");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <ul className="flex gap-1" aria-label={t("label")}>
      {routing.locales.map((locale) => (
        <li key={locale}>
          <Link
            href={pathname}
            locale={locale}
            hrefLang={locale}
            lang={locale}
            aria-current={locale === current ? "true" : undefined}
            className="touch-target inline-flex items-center justify-center rounded-md px-2 py-1.5 text-sm uppercase hover:bg-surface aria-[current=true]:bg-accent aria-[current=true]:text-accent-fg"
          >
            <span aria-hidden="true">{locale}</span>
            <span className="sr-only">{t(locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
