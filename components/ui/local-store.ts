"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny external store over one localStorage key, for useSyncExternalStore. Every component using the
 * same store updates together, other tabs are followed via the `storage` event, server and first client
 * render see "" (nothing saved), and if storage is blocked the value still lives in memory for the visit.
 */
export function createLocalStore(key: string) {
  const listeners = new Set<() => void>();
  let memory: string | null = null;

  function read(): string {
    if (memory !== null) return memory;
    try {
      return window.localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  }

  function write(value: string) {
    memory = value;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage blocked: keep the in-memory copy.
    }
    for (const l of listeners) l();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
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

  /** The raw stored string ("" when nothing is saved). */
  function useValue(): string {
    return useSyncExternalStore(subscribe, read, () => "");
  }

  return { read, write, useValue };
}
