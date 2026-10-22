"use client";

import { useTranslations } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";
import {
  INSTALL_DISMISSED_KEY,
  isStandaloneDisplay,
  needsIosInstallHelp,
} from "@/lib/pwa/platform";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __faInstall?: InstallEvent | null;
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("fa-installable", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("fa-installable", listener);
  };
}

function dismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** "native": Chrome's install prompt is available; "ios": show the Add to Home Screen help; "none". */
function getSnapshot(): "native" | "ios" | "none" {
  const standalone = isStandaloneDisplay(
    (q) => window.matchMedia(q),
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  if (standalone || dismissed()) return "none";
  if (window.__faInstall) return "native";
  if (needsIosInstallHelp(navigator.userAgent, standalone)) return "ios";
  return "none";
}

const getServerSnapshot = () => "none" as const;

/** Offers to install the app where the browser supports it; never shown once installed or dismissed. */
export function InstallPrompt() {
  const t = useTranslations("Pwa");
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const install = useCallback(async () => {
    const event = window.__faInstall;
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => null);
    window.__faInstall = null; // a prompt can only be used once
    notify();
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      // Not remembered; hidden for this visit only.
    }
    window.__faInstall = null;
    notify();
  }, []);

  if (mode === "none") return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm print:hidden">
      {mode === "native" ? (
        <button
          type="button"
          onClick={install}
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-fg"
        >
          {t("install")}
        </button>
      ) : (
        <p>{t("installIos")}</p>
      )}
      <button type="button" onClick={dismiss} className="text-accent underline">
        {t("notNow")}
      </button>
    </div>
  );
}
