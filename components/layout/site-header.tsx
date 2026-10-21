import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { MainNav } from "./main-nav";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          FreerideAtlas
        </Link>
        <MainNav />
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
