"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { isActiveSection, NAV_ITEMS, type NavKey } from "@/lib/nav";

// Simple 24px line icons (stroke uses the current text colour). Decorative: the label is always shown.
const ICONS: Record<NavKey, React.ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" />,
  resorts: (
    <>
      <path d="M2.5 19.5 9 8l4 7 2.5-4 6 8.5z" />
      <path d="m7.4 10.8 1.6 1.4 1.5-1.2" />
    </>
  ),
  avalanche: (
    <>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 9.5v4.5M12 16.6v.4" />
    </>
  ),
  powder: (
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />
  ),
  safety: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
      <path d="m8.8 12 2.3 2.3 4.2-4.6" />
    </>
  ),
};

/**
 * App-style section tabs fixed to the bottom of small screens (phones, including the installed app).
 * Wider screens use the header menu. Labels are short forms of the header menu entries.
 */
export function BottomTabs() {
  const t = useTranslations("Tabs");
  const nav = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={nav("menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden print:hidden"
      data-testid="bottom-tabs"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, key }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={
                isActiveSection(href, pathname) ? "page" : undefined
              }
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium leading-tight text-muted aria-[current=page]:text-accent"
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[key]}
              </svg>
              <span className="max-w-full truncate">{t(key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
