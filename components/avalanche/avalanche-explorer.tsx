"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeferredAvalancheMap } from "@/components/avalanche/deferred-map";
import { RegionList } from "@/components/avalanche/region-list";
import { RegionPanel } from "@/components/avalanche/region-panel";
import { MapViewToggle } from "@/components/avalanche/map-view-toggle";
import {
  ensureGraphicsProbed,
  useMapView,
} from "@/components/avalanche/use-map-view";
import { useNow } from "@/components/avalanche/use-now";
import { useModalLayer } from "@/components/ui/use-modal-layer";
import type { RegionMeta } from "@/lib/avalanche/meta";
import { NO_DATA_FILL } from "@/lib/avalanche/map-style";
import {
  currentLevels,
  downgradeExpired,
  type AvalancheView,
} from "@/lib/avalanche/view";
import { DANGER_COLORS } from "@/lib/palette";
import type { DangerLevel } from "@/lib/schemas/avalanche";

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

const HASH_PREFIX = "#r=";
const readHash = () =>
  window.location.hash.startsWith(HASH_PREFIX)
    ? decodeURIComponent(window.location.hash.slice(HASH_PREFIX.length))
    : null;

export function AvalancheExplorer({
  view: serverView,
  latestPublished,
}: {
  view: AvalancheView;
  /** ISO time of the newest bulletin we hold, if any. */
  latestPublished?: string;
}) {
  const t = useTranslations("Avalanche");
  const format = useFormatter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<RegionMeta | null>(null);

  // The page is cached for minutes: re-check freshness with the visitor's clock (downgrade only).
  const now = useNow();
  const view = useMemo(
    () => (now ? downgradeExpired(serverView, now) : serverView),
    [serverView, now],
  );
  const levels = useMemo(() => currentLevels(view), [view]);
  const currentCount = Object.keys(levels).length;
  const mapView = useMapView();

  // Full-screen map (phones especially). The same map instance is enlarged in place, not re-created.
  const [fullScreen, setFullScreen] = useState(false);
  // Opening full screen starts the map; it then stays loaded after closing.
  const [mapStarted, setMapStarted] = useState(false);
  const mapColumn = useRef<HTMLDivElement>(null);
  const fullScreenButton = useRef<HTMLButtonElement>(null);
  const exitFullScreen = useCallback(() => setFullScreen(false), []);
  useModalLayer(mapColumn, fullScreen, exitFullScreen, fullScreenButton);

  // Where the camera should go: the selected region's box, once the region metadata has loaded.
  const box = selectedId ? meta?.regions[selectedId]?.b : undefined;
  const focus = useMemo(
    () => (selectedId && box ? { id: selectedId, bbox: box } : null),
    [selectedId, box],
  );

  const select = useCallback((id: string) => {
    setSelectedId(id);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${HASH_PREFIX}${encodeURIComponent(id)}`,
    );
  }, []);

  // Deep link from a resort page: /avalanche#r=AT-07-07
  useEffect(() => {
    const fromHash = () => {
      const id = readHash();
      if (id) setSelectedId(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
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
      <div className="space-y-1 text-sm" aria-live="polite">
        <p className="font-semibold">
          {currentCount > 0
            ? t("summaryCurrent", { count: currentCount })
            : t("summaryNone")}
        </p>
        {latestPublished && (
          <p className="text-muted">
            {t("lastPublished", {
              time: format.dateTime(new Date(latestPublished), {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Vienna",
                timeZoneName: "short",
              }),
            })}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div
          ref={mapColumn}
          role={fullScreen ? "dialog" : undefined}
          aria-modal={fullScreen || undefined}
          aria-label={fullScreen ? t("fullScreenLabel") : undefined}
          data-testid="map-column"
          data-full-screen={fullScreen || undefined}
          className={
            fullScreen
              ? "fixed inset-0 z-50 flex flex-col gap-2 bg-bg pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
              : "space-y-3"
          }
        >
          {!fullScreen && (
            <a
              href="#region-list"
              className="sr-only focus:not-sr-only focus:inline-block focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
            >
              {t("skipToList")}
            </a>
          )}
          <div className="flex flex-wrap items-start gap-2">
            <MapViewToggle
              available={mapView.available}
              view={mapView.view}
              onChange={mapView.setView}
            />
            <button
              ref={fullScreenButton}
              type="button"
              onClick={() => {
                if (!fullScreen) {
                  ensureGraphicsProbed();
                  setMapStarted(true);
                }
                setFullScreen(!fullScreen);
              }}
              className="ml-auto rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent"
            >
              {t(fullScreen ? "exitFullScreen" : "fullScreen")}
            </button>
          </div>
          <div className={fullScreen ? "min-h-0 flex-1" : undefined}>
            <DeferredAvalancheMap
              levels={levels}
              selectedId={selectedId}
              onSelect={select}
              view={mapView.view}
              focus={focus}
              fill={fullScreen}
              autoStart={mapStarted}
            />
          </div>
          {fullScreen ? (
            selectedId && (
              <div className="max-h-[40%] shrink-0 overflow-y-auto">
                <RegionPanel regionId={selectedId} view={view} meta={meta} />
              </div>
            )
          ) : (
            <>
              <p className="text-xs text-muted">
                {t(mapView.view === "3d" ? "mapHint3d" : "mapHint")}
              </p>
              <Legend />
            </>
          )}
        </div>
        <RegionPanel regionId={selectedId} view={view} meta={meta} />
      </div>
      <RegionList
        view={view}
        meta={meta}
        selectedId={selectedId}
        onSelect={select}
      />
    </div>
  );
}
