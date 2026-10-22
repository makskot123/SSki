"use client";

import { useCallback, useMemo } from "react";
import { createLocalStore } from "@/components/ui/local-store";
import {
  FAVOURITES_STORAGE_KEY,
  parseFavourites,
  toggleFavourite,
} from "@/lib/favourites";

// Shared by every star button and the home page card, so they update together.
const store = createLocalStore(FAVOURITES_STORAGE_KEY);

/** Saved resort slugs (in saved order), optionally limited to resorts that still exist. */
export function useFavourites(knownSlugs?: string[]) {
  const raw = store.useValue();
  const favourites = useMemo(
    () => parseFavourites(raw, knownSlugs),
    [raw, knownSlugs],
  );
  const toggle = useCallback((slug: string) => {
    store.write(
      JSON.stringify(toggleFavourite(parseFavourites(store.read()), slug)),
    );
  }, []);
  return { favourites, toggle };
}
