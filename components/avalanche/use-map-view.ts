"use client";

import { useCallback, useSyncExternalStore } from "react";
import { canUse3D, probeGraphics, type GraphicsInfo } from "@/lib/map/graphics";
import {
  MAP_VIEW_STORAGE_KEY,
  parseMapView,
  resolveMapView,
  type MapView,
} from "@/lib/map/view-preference";

/*
 * Device capability + the visitor's saved 2D/3D choice, as a tiny external store. The server snapshot is
 * "unknown / 2D", so the server and the first client render agree; the real values arrive right after.
 *
 * Probing the GPU creates a WebGL context, which is expensive on slow phones (it pushed Lighthouse's
 * blocking time from ~200 to ~750 ms in A1). So it is NOT done on page load: only when the visitor starts
 * the map or presses the 3D button (`ensureGraphicsProbed`). Until then 3D is assumed to be possible.
 */
const listeners = new Set<() => void>();
let graphics: GraphicsInfo | null = null;
let saved: MapView | null | undefined; // undefined = not read yet

const notify = () => listeners.forEach((l) => l());

/** Reads the device's 3D capability once. Call right before the map is created or the view changes. */
export function ensureGraphicsProbed() {
  if (graphics) return;
  graphics = probeGraphics();
  notify();
}

function readSaved(): MapView | null {
  try {
    return parseMapView(window.localStorage.getItem(MAP_VIEW_STORAGE_KEY));
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A string snapshot keeps React's equality check cheap: "<available u|0|1>|<view>". */
function getSnapshot(): string {
  if (saved === undefined) saved = readSaved();
  const can3D = graphics ? canUse3D(graphics) : null;
  const phoneLike = window.matchMedia(
    "(max-width: 767px), (pointer: coarse)",
  ).matches;
  const view = resolveMapView({ saved, can3D: can3D ?? true, phoneLike });
  return `${can3D === null ? "u" : can3D ? 1 : 0}|${view}`;
}

const getServerSnapshot = () => "u|2d";

export function useMapView(): {
  /** null until known in the browser. */
  available: boolean | null;
  view: MapView;
  setView: (view: MapView) => void;
} {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [availability, view] = snapshot.split("|") as [string, MapView];

  const setView = useCallback((next: MapView) => {
    saved = next;
    try {
      window.localStorage.setItem(MAP_VIEW_STORAGE_KEY, next);
    } catch {
      // Not remembered, but the choice still applies for this visit.
    }
    // Asking for 3D is the moment to find out whether the device can do it.
    if (next === "3d") ensureGraphicsProbed();
    notify();
  }, []);

  return {
    /** null until probed (see ensureGraphicsProbed); 3D is assumed possible until then. */
    available: availability === "u" ? null : availability === "1",
    view,
    setView,
  };
}
