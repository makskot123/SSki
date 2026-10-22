import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header
      data-site-header
      className="border-b border-border bg-bg pt-[env(safe-area-inset-top)] print:hidden"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 py-3 safe-x">
        <Link
          href="/"
          className="touch-target inline-flex items-center text-lg font-bold tracking-tight"
        >
          FreerideAtlas
        </Link>
        {/* Phones get the bottom tabs instead (components/layout/bottom-tabs.tsx). */}
        <div className="hidden md:block">
          <MainNav />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
