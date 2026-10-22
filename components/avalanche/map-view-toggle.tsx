"use client";

import { useTranslations } from "next-intl";
import type { MapView } from "@/lib/map/view-preference";

/** 2D/3D switch. Disabled, with the reason, when the device cannot draw 3D terrain. */
export function MapViewToggle({
  available,
  view,
  onChange,
}: {
  available: boolean | null;
  view: MapView;
  onChange: (view: MapView) => void;
}) {
  const t = useTranslations("Avalanche");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        aria-pressed={view === "3d"}
        disabled={available === false}
        onClick={() => onChange(view === "3d" ? "2d" : "3d")}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-fg"
      >
        {t("view3d")}
      </button>
      {available === false && <p className="text-xs text-muted">{t("no3d")}</p>}
    </div>
  );
}
