import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

/** The app icon in miniature (same artwork as public/icons). Decorative: the name is next to it. */
function LogoMark() {
  return (
    <svg viewBox="0 0 512 512" width="28" height="28" aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#0e1620" />
      <polygon points="56,392 206,136 286,268 338,196 456,392" fill="#3b5a78" />
      <polygon
        points="206,136 250,212 228,200 210,224 190,200 166,206"
        fill="#f4f8fb"
      />
      <polygon
        points="338,196 368,248 352,240 338,254 324,240 312,240"
        fill="#f4f8fb"
      />
      <rect x="56" y="392" width="400" height="22" rx="11" fill="#6cb4ff" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header
      data-site-header
      className="sticky top-0 z-30 border-b border-border bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md print:static print:hidden"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-x-6 py-2 safe-x">
        <Link
          href="/"
          className="touch-target inline-flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <LogoMark />
          FreerideAtlas
        </Link>
        {/* Phones and tablets get the bottom tabs instead (components/layout/bottom-tabs.tsx). */}
        <div className="hidden lg:block">
          <MainNav />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
