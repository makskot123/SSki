"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type {
  FilterSpecification,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
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

export interface AvalancheMapProps {
  levels: Record<string, DangerLevel>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Regions to outline (e.g. a resort's own regions). Without it, the selected region is outlined. */
  focusIds?: string[];
  /** Initial camera; defaults to the Alps and surroundings. */
  initialView?: { center: [number, number]; zoom: number };
  /** A labelled point, e.g. the resort. */
  marker?: { lon: number; lat: number; label: string };
  /** Accessible name; defaults to the Lawinomierz map label. */
  label?: string;
  heightClass?: string;
}

function outlineFilter(
  focusIds: string[] | undefined,
  selectedId: string | null,
): FilterSpecification {
  return focusIds
    ? ["in", ["get", "id"], ["literal", focusIds]]
    : ["==", ["get", "id"], selectedId ?? ""];
}

export default function AvalancheMap({
  levels,
  selectedId,
  onSelect,
  focusIds,
  initialView = { center: [10.5, 47], zoom: 4.6 },
  marker,
  label,
  heightClass = "h-[26rem] lg:h-[34rem]",
}: AvalancheMapProps) {
  const t = useTranslations("Avalanche");
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  // Latest values for callbacks created once inside the map setup.
  const latest = useRef({ levels, selectedId, onSelect, focusIds });
  useEffect(() => {
    latest.current = { levels, selectedId, onSelect, focusIds };
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
          center: initialView.center,
          zoom: initialView.zoom,
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

        if (marker) {
          const el = document.createElement("div");
          el.setAttribute("role", "img");
          el.setAttribute("aria-label", marker.label);
          el.style.cssText =
            "width:18px;height:18px;border-radius:50%;background:#0b5cad;border:3px solid #fff;box-shadow:0 0 0 1.5px #000";
          new maplibre.Marker({ element: el })
            .setLngLat([marker.lon, marker.lat])
            .addTo(map);
        }

        map.on("load", () => {
          if (!map) return;
          const { levels: l, selectedId: s, focusIds: f } = latest.current;
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
            filter: outlineFilter(f, s),
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
        // e.g. WebGL unavailable. The page content outside the map is the complete fallback.
        console.warn("[avalanche map] could not start:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
    // The camera and marker are fixed for the lifetime of a map instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    map.setFilter("regions-selected", outlineFilter(focusIds, selectedId));
  }, [selectedId, focusIds, status]);

  return (
    <div className="relative">
      <div
        ref={container}
        role="region"
        aria-label={label ?? t("mapLabel")}
        data-testid="avalanche-map"
        data-map-status={status}
        data-coloured={
          status === "ready" ? Object.keys(levels).length : undefined
        }
        className={`${heightClass} w-full overflow-hidden rounded-lg border border-border bg-surface`}
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
