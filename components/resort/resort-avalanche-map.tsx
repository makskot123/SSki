"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { DeferredAvalancheMap } from "@/components/avalanche/deferred-map";
import { MapViewToggle } from "@/components/avalanche/map-view-toggle";
import { useMapView } from "@/components/avalanche/use-map-view";
import { useNow } from "@/components/avalanche/use-now";
import { useRouter } from "@/i18n/navigation";
import {
  summariseResort,
  type ResortRegion,
} from "@/lib/avalanche/resort-status";
import type { DangerLevel } from "@/lib/schemas/avalanche";

/**
 * Orientation map for a resort: its marker, the outline of its avalanche region(s), and a danger colour
 * only where a bulletin is current right now (judged with the visitor's clock).
 */
export function ResortAvalancheMap({
  resortName,
  position,
  regionIds,
  regions,
  renderedAt,
}: {
  resortName: string;
  position: { lon: number; lat: number };
  regionIds: string[];
  regions: ResortRegion[];
  renderedAt: string;
}) {
  const t = useTranslations("ResortAvalanche");
  const ta = useTranslations("Avalanche");
  const router = useRouter();
  // The same 2D/3D choice as the avalanche page (one preference per device).
  const mapView = useMapView();
  const browserNow = useNow();

  const levels = useMemo(() => {
    const now = browserNow ?? new Date(renderedAt);
    const out: Record<string, DangerLevel> = {};
    for (const r of summariseResort(regions, now).current) {
      if (r.bulletin?.maxDangerLevel)
        out[r.regionId] = r.bulletin.maxDangerLevel;
    }
    return out;
  }, [regions, browserNow, renderedAt]);

  return (
    <section aria-labelledby="resort-map-title" className="space-y-2">
      <h2 id="resort-map-title" className="text-xl font-semibold">
        {t("mapTitle")}
      </h2>
      <MapViewToggle
        available={mapView.available}
        view={mapView.view}
        onChange={mapView.setView}
      />
      <DeferredAvalancheMap
        levels={levels}
        view={mapView.view}
        selectedId={null}
        focusIds={regionIds}
        onSelect={(id) => router.push(`/avalanche#r=${encodeURIComponent(id)}`)}
        initialView={{ center: [position.lon, position.lat], zoom: 9.8 }}
        marker={{
          lon: position.lon,
          lat: position.lat,
          label: t("markerLabel", { name: resortName }),
        }}
        label={t("mapLabel", { name: resortName })}
        heightClass="h-80 lg:h-96"
      />
      <p className="text-xs text-muted">{t("mapNote")}</p>
      {mapView.view === "3d" && (
        <p className="text-xs text-muted">{ta("mapHint3d")}</p>
      )}
    </section>
  );
}
