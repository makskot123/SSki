"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

/** Shown while the device is offline: pages and data come from the last visit. */
export function OfflineBanner() {
  const t = useTranslations("Pwa");
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="border-b border-border bg-fg px-4 py-2 text-center text-sm font-medium text-bg print:hidden"
    >
      {t("offline")}
    </div>
  );
}
