"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { AvalancheMapProps } from "@/components/avalanche/avalanche-map";
import { ensureGraphicsProbed } from "@/components/avalanche/use-map-view";

// MapLibre is large: load it only in the browser, and only after the visitor engages.
const AvalancheMap = dynamic(
  () => import("@/components/avalanche/avalanche-map"),
  { ssr: false, loading: () => <MapLoading /> },
);

const DEFAULT_HEIGHT = "h-[26rem] lg:h-[34rem]";
const boxClass =
  "flex flex-col items-center justify-center gap-3 card p-4 text-center text-sm text-muted";

function MapLoading() {
  const t = useTranslations("Avalanche");
  return (
    <div className={`${boxClass} ${DEFAULT_HEIGHT}`}>{t("mapLoading")}</div>
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

/**
 * Renders the map only after the first sign of a real visitor (any input) or a click on the button,
 * so the heavy map library never competes with first paint. The surrounding page works without it.
 */
export function DeferredAvalancheMap({
  autoStart = false,
  ...props
}: AvalancheMapProps & {
  /** Start the map now (e.g. the visitor opened the full-screen map). Keep it true once set. */
  autoStart?: boolean;
}) {
  const t = useTranslations("Avalanche");
  const [requested, setRequested] = useState(false);
  const placeholder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const request = () => {
      // Probe the GPU now, so a device without 3D gets the 2D map from the start.
      ensureGraphicsProbed();
      setRequested(true);
    };
    const options = { once: true, passive: true, capture: true } as const;
    for (const type of INTERACTION_EVENTS) {
      window.addEventListener(type, request, options);
    }
    // Marks that interaction now starts the map (before hydration it cannot). Used by the e2e tests.
    placeholder.current?.setAttribute("data-armed", "true");
    return () => {
      for (const type of INTERACTION_EVENTS) {
        window.removeEventListener(type, request, { capture: true });
      }
    };
  }, []);

  if (requested || autoStart) return <AvalancheMap {...props} />;

  return (
    <div
      ref={placeholder}
      className={`${boxClass} ${props.fill ? "h-full" : (props.heightClass ?? DEFAULT_HEIGHT)}`}
      data-testid="avalanche-map-placeholder"
    >
      <button
        type="button"
        onClick={() => {
          ensureGraphicsProbed();
          setRequested(true);
        }}
        className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:opacity-90"
      >
        {t("loadMap")}
      </button>
      <p className="max-w-sm">{t("mapDeferred")}</p>
    </div>
  );
}
