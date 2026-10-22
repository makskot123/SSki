"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { SectionIcon } from "@/components/ui/section-icon";
import { isActiveSection, NAV_ITEMS } from "@/lib/nav";

/**
 * App-style section tabs fixed to the bottom of small screens (phones, including the installed app).
 * Screens 1024 px and wider use the header menu. Labels are short forms of the header menu entries.
 */
export function BottomTabs() {
  const t = useTranslations("Tabs");
  const nav = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={nav("menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden print:hidden"
      data-testid="bottom-tabs"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map(({ href, key }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={
                isActiveSection(href, pathname) ? "page" : undefined
              }
              className="group flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium leading-tight text-muted aria-[current=page]:text-accent"
            >
              <span className="rounded-full px-3 py-0.5 transition-colors group-aria-[current=page]:bg-accent/10">
                <SectionIcon name={key} />
              </span>
              <span className="max-w-full truncate">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
