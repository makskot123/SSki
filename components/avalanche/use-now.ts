"use client";

import { useEffect, useState } from "react";

/**
 * The visitor's clock, or null until the component has mounted (so server and first client render match).
 * Used to re-check bulletin freshness in the browser, because pages are cached for several minutes.
 */
export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
