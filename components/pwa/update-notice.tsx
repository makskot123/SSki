"use client";

import { useSerwist } from "@serwist/turbopack/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * A new version has been downloaded and is waiting: offer to switch to it. It is not activated behind the
 * visitor's back, so a page in use (a half-done quiz, an open map) is never swapped mid-way.
 */
export function UpdateNotice() {
  const t = useTranslations("Pwa");
  const { serwist } = useSerwist();
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setWaiting(true);
    serwist.addEventListener("waiting", onWaiting);
    return () => serwist.removeEventListener("waiting", onWaiting);
  }, [serwist]);

  if (!waiting || !serwist) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-surface px-4 py-2 text-sm print:hidden"
    >
      <span>{t("updateAvailable")}</span>
      <button
        type="button"
        onClick={() => {
          serwist.addEventListener("controlling", () =>
            window.location.reload(),
          );
          serwist.messageSkipWaiting();
        }}
        className="rounded-md bg-accent px-3 py-1 font-medium text-accent-fg"
      >
        {t("reload")}
      </button>
    </div>
  );
}
