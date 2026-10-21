"use client";

import { useLocale, useTranslations } from "next-intl";
import { DangerBadge } from "@/components/avalanche/danger-badge";
import {
  regionName,
  type RegionMeta,
} from "@/components/avalanche/region-panel";
import { bulletinFor, type AvalancheView } from "@/lib/avalanche/view";
import type { DangerLevel } from "@/lib/schemas/avalanche";

interface Item {
  id: string;
  name: string;
  state: "current" | "stale";
  level: DangerLevel | null;
}

const levelOf = (view: AvalancheView, id: string): DangerLevel | null =>
  bulletinFor(view, id)?.maxDangerLevel ?? null;

/** Keyboard- and screen-reader-friendly alternative to the map: every region with a bulletin, as buttons. */
export function RegionList({
  view,
  meta,
  selectedId,
  onSelect,
}: {
  view: AvalancheView;
  meta: RegionMeta | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Avalanche");
  const locale = useLocale();

  const items: Item[] = Object.entries(view.regions)
    .map(([id, entry]) => ({
      id,
      name: regionName(id, view, meta, locale),
      state: entry.state,
      level: entry.state === "current" ? levelOf(view, id) : null,
    }))
    .sort(
      (a, b) =>
        Number(b.state === "current") - Number(a.state === "current") ||
        (b.level ?? 0) - (a.level ?? 0) ||
        a.name.localeCompare(b.name, locale),
    );
  const current = items.filter((i) => i.state === "current");
  const stale = items.filter((i) => i.state === "stale");

  const button = (item: Item) => (
    <li key={item.id}>
      <button
        type="button"
        aria-pressed={item.id === selectedId}
        onClick={() => onSelect(item.id)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm hover:border-accent aria-pressed:border-2 aria-pressed:border-accent"
      >
        <span>{item.name}</span>
        {item.level ? (
          <DangerBadge level={item.level} />
        ) : (
          <span className="text-muted">{t("noCurrent")}</span>
        )}
      </button>
    </li>
  );

  return (
    <section
      id="region-list"
      aria-labelledby="list-title"
      className="scroll-mt-4 space-y-3"
    >
      <div>
        <h2 id="list-title" className="text-xl font-semibold">
          {t("listTitle")}
        </h2>
        <p className="text-sm text-muted">{t("listHelp")}</p>
      </div>
      {current.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {current.map(button)}
        </ul>
      ) : (
        stale.length === 0 && <p className="text-muted">{t("noneListed")}</p>
      )}
      {stale.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            {t("staleSummary", { count: stale.length })}
          </summary>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stale.map(button)}
          </ul>
        </details>
      )}
    </section>
  );
}
