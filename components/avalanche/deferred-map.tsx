"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { AvalancheMapProps } from "@/components/avalanche/avalanche-map";

// MapLibre is large: load it only in the browser, and only after the visitor engages.
const AvalancheMap = dynamic(
  () => import("@/components/avalanche/avalanche-map"),
  { ssr: false, loading: () => <MapLoading /> },
);

const DEFAULT_HEIGHT = "h-[26rem] lg:h-[34rem]";
const boxClass =
  "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-4 text-center text-sm text-muted";

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
export function DeferredAvalancheMap(props: AvalancheMapProps) {
  const t = useTranslations("Avalanche");
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const request = () => setRequested(true);
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

  if (requested) return <AvalancheMap {...props} />;

  return (
    <div
      className={`${boxClass} ${props.heightClass ?? DEFAULT_HEIGHT}`}
      data-testid="avalanche-map-placeholder"
    >
      <button
        type="button"
        onClick={() => setRequested(true)}
        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg"
      >
        {t("loadMap")}
      </button>
      <p className="max-w-sm">{t("mapDeferred")}</p>
    </div>
  );
}
