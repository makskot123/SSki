"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  fillColorExpression,
  fillOpacityExpression,
} from "@/lib/avalanche/map-style";
import type { DangerLevel } from "@/lib/schemas/avalanche";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const REGIONS_URL = "/data/avalanche-regions.json";

/** Used if the third-party basemap cannot be fetched: the region polygons are the product, not the tiles. */
const BLANK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#dde5ec" },
    },
  ],
};

async function loadStyle(): Promise<StyleSpecification | string> {
  try {
    const res = await fetch(STYLE_URL, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as StyleSpecification;
  } catch {
    return BLANK_STYLE;
  }
}

type Status = "loading" | "ready" | "error";

export default function AvalancheMap({
  levels,
  selectedId,
  onSelect,
}: {
  levels: Record<string, DangerLevel>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("Avalanche");
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Latest values for callbacks created once inside the map setup.
  const latest = useRef({ levels, selectedId, onSelect });
  useEffect(() => {
    latest.current = { levels, selectedId, onSelect };
  });

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;

    (async () => {
      try {
        const [maplibre, style] = await Promise.all([
          import("maplibre-gl"),
          loadStyle(),
        ]);
        if (cancelled || !container.current) return;
        // The worker is served as a static file (see scripts/copy-maplibre-worker.mjs).
        maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

        map = new maplibre.Map({
          container: container.current,
          style,
          center: [10.5, 47],
          zoom: 4.6,
          minZoom: 3,
          maxZoom: 11,
          cooperativeGestures: true, // never trap page scrolling on touch devices
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.addControl(
          new maplibre.NavigationControl({ showCompass: false }),
          "top-right",
        );

        map.on("load", () => {
          if (!map) return;
          const { levels: l, selectedId: s } = latest.current;
          // Put our polygons under the basemap's labels when it has any.
          const firstLabel = map
            .getStyle()
            .layers.find((layer) => layer.type === "symbol")?.id;

          map.addSource("regions", { type: "geojson", data: REGIONS_URL });
          map.addLayer(
            {
              id: "regions-fill",
              type: "fill",
              source: "regions",
              paint: {
                "fill-color": fillColorExpression(l),
                "fill-opacity": fillOpacityExpression(l),
              },
            },
            firstLabel,
          );
          map.addLayer(
            {
              id: "regions-line",
              type: "line",
              source: "regions",
              paint: {
                "line-color": "#4b5a69",
                "line-width": 0.6,
                "line-opacity": 0.7,
              },
            },
            firstLabel,
          );
          map.addLayer({
            id: "regions-selected",
            type: "line",
            source: "regions",
            filter: ["==", ["get", "id"], s ?? ""],
            paint: { "line-color": "#000000", "line-width": 3 },
          });

          map.on("click", "regions-fill", (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === "string") latest.current.onSelect(id);
          });
          map.on(
            "mouseenter",
            "regions-fill",
            () => (map!.getCanvas().style.cursor = "pointer"),
          );
          map.on(
            "mouseleave",
            "regions-fill",
            () => (map!.getCanvas().style.cursor = ""),
          );
          setStatus("ready");
        });
      } catch (err) {
        // e.g. WebGL unavailable. The region list below is the complete fallback.
        console.warn("[avalanche map] could not start:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    map.setPaintProperty(
      "regions-fill",
      "fill-color",
      fillColorExpression(levels),
    );
    map.setPaintProperty(
      "regions-fill",
      "fill-opacity",
      fillOpacityExpression(levels),
    );
  }, [levels, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    map.setFilter("regions-selected", ["==", ["get", "id"], selectedId ?? ""]);
  }, [selectedId, status]);

  return (
    <div className="relative">
      <div
        ref={container}
        role="region"
        aria-label={t("mapLabel")}
        data-testid="avalanche-map"
        data-map-status={status}
        data-coloured={
          status === "ready" ? Object.keys(levels).length : undefined
        }
        className="h-[26rem] w-full overflow-hidden rounded-lg border border-border bg-surface lg:h-[34rem]"
      />
      {status === "loading" && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
          {t("mapLoading")}
        </p>
      )}
      {status === "error" && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm"
        >
          {t("mapUnavailable")}
        </p>
      )}
    </div>
  );
}
