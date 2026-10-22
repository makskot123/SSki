import { SectionIcon, type IconName } from "@/components/ui/section-icon";
import { Link } from "@/i18n/navigation";

export interface Tile {
  href: string;
  icon: IconName;
  title: string;
  body: string;
}

/** App-style shortcuts to the main tools. */
export function QuickTiles({ tiles, label }: { tiles: Tile[]; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="card group flex h-full flex-col gap-3 p-4 transition-colors hover:border-accent"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <SectionIcon name={tile.icon} size={22} />
              </span>
              <span className="font-semibold group-hover:text-accent">
                {tile.title}
              </span>
              <span className="text-sm text-muted">{tile.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
