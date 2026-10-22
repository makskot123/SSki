"use client";

import { useTranslations } from "next-intl";

export function ThemeToggle() {
  const t = useTranslations("Theme");

  function toggle() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage may be blocked; the theme still applies for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // The accessible name starts with the visible word ("Dark mode" / "Light mode"), as WCAG 2.5.3 asks.
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
    >
      <span className="dark:hidden">{t("dark")}</span>
      <span className="hidden dark:inline">{t("light")}</span>
      <span className="sr-only"> {t("mode")}</span>
    </button>
  );
}
