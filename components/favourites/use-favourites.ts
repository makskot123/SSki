"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  FAVOURITES_STORAGE_KEY,
  parseFavourites,
  toggleFavourite,
} from "@/lib/favourites";

/*
 * Small external store over localStorage, shared by every star button and the home page card, so they
 * update together. Server and first client render see no favourites. If storage is blocked, favourites
 * still work for the current page view.
 */
const listeners = new Set<() => void>();
let memory: string | null = null;

function read(): string {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(FAVOURITES_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function write(value: string) {
  memory = value;
  try {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, value);
  } catch {
    // Storage blocked: keep the in-memory copy.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === FAVOURITES_STORAGE_KEY || e.key === null) {
      memory = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Saved resort slugs (in saved order), optionally limited to resorts that still exist. */
export function useFavourites(knownSlugs?: string[]) {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const favourites = useMemo(
    () => parseFavourites(raw, knownSlugs),
    [raw, knownSlugs],
  );
  const toggle = useCallback((slug: string) => {
    write(JSON.stringify(toggleFavourite(parseFavourites(read()), slug)));
  }, []);
  return { favourites, toggle };
}
