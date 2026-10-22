"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isActiveSection, NAV_ITEMS } from "@/lib/nav";

export function MainNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("menu")}>
      <ul className="flex flex-wrap gap-1">
        {NAV_ITEMS.map(({ href, key }) => {
          const active = isActiveSection(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-surface aria-[current=page]:bg-accent aria-[current=page]:text-accent-fg"
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
