"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { RegionList } from "@/components/avalanche/region-list";
import {
  RegionPanel,
  type RegionMeta,
} from "@/components/avalanche/region-panel";
import { currentLevels, type AvalancheView } from "@/lib/avalanche/view";
import { DANGER_COLORS } from "@/lib/palette";
import type { DangerLevel } from "@/lib/schemas/avalanche";
import { NO_DATA_FILL } from "@/lib/avalanche/map-style";

// MapLibre is large: load it only in the browser and only for this page.
const AvalancheMap = dynamic(
  () => import("@/components/avalanche/avalanche-map"),
  {
    ssr: false,
    loading: () => <MapLoading />,
  },
);

const boxClass =
  "flex h-[26rem] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-4 text-center text-sm text-muted lg:h-[34rem]";

function MapLoading() {
  const t = useTranslations("Avalanche");
  return <div className={boxClass}>{t("mapLoading")}</div>;
}

/** Shown until the visitor interacts: the heavy map library is not part of the first load. */
function MapPlaceholder({ onLoad }: { onLoad: () => void }) {
  const t = useTranslations("Avalanche");
  return (
    <div className={boxClass} data-testid="avalanche-map-placeholder">
      <button
        type="button"
        onClick={onLoad}
        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg"
      >
        {t("loadMap")}
      </button>
      <p className="max-w-sm">{t("mapDeferred")}</p>
    </div>
  );
}

const INTERACTION_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
] as const;

function Legend() {
  const t = useTranslations("Avalanche");
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{t("legendTitle")}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {([1, 2, 3, 4, 5] as DangerLevel[]).map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 rounded-sm border border-fg/40"
              style={{ backgroundColor: DANGER_COLORS[level].fill }}
            />
            {level} {t(`levels.${level}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-sm border border-fg/40 opacity-50"
            style={{ backgroundColor: NO_DATA_FILL }}
          />
          {t("legendNoData")}
        </li>
      </ul>
    </div>
  );
}

export function AvalancheExplorer({ view }: { view: AvalancheView }) {
  const t = useTranslations("Avalanche");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<RegionMeta | null>(null);
  const [mapRequested, setMapRequested] = useState(false);
  const levels = useMemo(() => currentLevels(view), [view]);

  // Start the map on the first sign of a real visitor, not at page load, so first paint stays fast.
  useEffect(() => {
    const request = () => setMapRequested(true);
    const options = { once: true, passive: true, capture: true } as const;
    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, request, options);
    }
    return () => {
      for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, request, { capture: true });
      }
    };
  }, []);

  // Names and official services for regions without a bulletin (small static file, ~10 KB gzipped).
  useEffect(() => {
    let cancelled = false;
    fetch("/data/avalanche-meta.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: RegionMeta | null) => !cancelled && m && setMeta(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-3">
          <a
            href="#region-list"
            className="sr-only focus:not-sr-only focus:inline-block focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
          >
            {t("skipToList")}
          </a>
          {mapRequested ? (
            <AvalancheMap
              levels={levels}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <MapPlaceholder onLoad={() => setMapRequested(true)} />
          )}
          <p className="text-xs text-muted">{t("mapHint")}</p>
          <Legend />
        </div>
        <RegionPanel regionId={selectedId} view={view} meta={meta} />
      </div>
      <RegionList
        view={view}
        meta={meta}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
  );
}
