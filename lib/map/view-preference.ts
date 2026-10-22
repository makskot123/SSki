export type MapView = "2d" | "3d";

/** Versioned so the format can change later without misreading old values. */
export const MAP_VIEW_STORAGE_KEY = "freeride-atlas:map-view:v1";

export function parseMapView(raw: string | null | undefined): MapView | null {
  return raw === "2d" || raw === "3d" ? raw : null;
}

/**
 * The view to show: the visitor's saved choice if any, otherwise 2D on phones (narrow screen or touch-first)
 * and 3D on larger screens. 3D is never chosen when the device cannot do it, whatever was saved.
 */
export function resolveMapView(options: {
  saved: MapView | null;
  can3D: boolean;
  phoneLike: boolean;
}): MapView {
  if (!options.can3D) return "2d";
  if (options.saved) return options.saved;
  return options.phoneLike ? "2d" : "3d";
}
