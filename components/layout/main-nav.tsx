"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const items = [
  { href: "/", key: "home" },
  { href: "/resorts", key: "resorts" },
  { href: "/avalanche", key: "avalanche" },
  { href: "/powder", key: "powder" },
  { href: "/safety", key: "safety" },
] as const;

export function MainNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("menu")}>
      <ul className="flex flex-wrap gap-1">
        {items.map(({ href, key }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
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
