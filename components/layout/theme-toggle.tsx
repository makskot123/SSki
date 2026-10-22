"use client";

import { useTranslations } from "next-intl";
import { SectionIcon } from "@/components/ui/section-icon";

export function ThemeToggle() {
  const t = useTranslations("Theme");

  function toggle() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    // Switch instantly: no colour transitions while every surface changes at once.
    const root = document.documentElement;
    root.setAttribute("data-theme-switching", "");
    root.dataset.theme = next;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => root.removeAttribute("data-theme-switching")),
    );
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
      className="touch-target inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-fg hover:border-accent"
    >
      {/* Icon only; the accessible name says what the button switches to ("Dark mode" / "Light mode"). */}
      <SectionIcon name="moon" size={18} className="dark:hidden" />
      <SectionIcon name="sun" size={18} className="hidden dark:block" />
      <span className="sr-only">
        <span className="dark:hidden">{t("dark")}</span>
        <span className="hidden dark:inline">{t("light")}</span> {t("mode")}
      </span>
    </button>
  );
}
