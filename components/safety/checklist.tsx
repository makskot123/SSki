"use client";

import { useMessages, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useMemo, useSyncExternalStore } from "react";
import {
  CHECKLIST_GROUPS,
  CHECKLIST_STORAGE_KEY,
  parseChecked,
  serialiseChecked,
  toggled,
} from "@/lib/safety/checklist";
import type { GearCategory } from "@/lib/schemas/gear";

/*
 * Tiny external store over localStorage. Reading through useSyncExternalStore keeps server and first
 * client render identical (nothing ticked) and avoids setting state inside an effect.
 * If storage is blocked (private mode, site data cleared), the list still works from memory.
 */
const listeners = new Set<() => void>();
let memory: string | null = null; // latest value written in this tab

function readStorage(): string {
  try {
    return window.localStorage.getItem(CHECKLIST_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the list: forget our copy and re-read.
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHECKLIST_STORAGE_KEY || e.key === null) {
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

const getSnapshot = () => memory ?? readStorage();
const getServerSnapshot = () => "";

function write(next: Set<string>) {
  const raw = serialiseChecked(next);
  memory = raw;
  try {
    window.localStorage.setItem(CHECKLIST_STORAGE_KEY, raw);
  } catch {
    // Not persisted, but the list keeps working for this visit.
  }
  listeners.forEach((l) => l());
}

/** Checklist items that have a gear-guide category (outside the label, so tapping it never ticks the box). */
const GEAR_LINKS: Partial<Record<string, GearCategory>> = {
  transceiver: "transceiver",
  probe: "probe",
  shovel: "shovel",
  airbag: "airbag",
  helmet: "helmet",
};

export function Checklist() {
  const t = useTranslations("Checklist");
  const tg = useTranslations("Gear");
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const checked = useMemo(() => parseChecked(raw), [raw]);

  const items = useMessages().Checklist.items;
  const total = CHECKLIST_GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <p aria-live="polite" className="font-semibold">
          {t("progress", { done: checked.size, total })}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
        >
          {t("print")}
        </button>
        <button
          type="button"
          onClick={() => write(new Set())}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          {t("reset")}
        </button>
      </div>

      {CHECKLIST_GROUPS.map((group) => (
        <fieldset key={group.id} className="space-y-2 break-inside-avoid">
          <legend className="mb-1 text-lg font-semibold">
            {t(`groups.${group.id}`)}
          </legend>
          <ul className="space-y-2">
            {group.items.map((item) => {
              const text = items[item.id as keyof typeof items];
              const hintId = `hint-${item.id}`;
              const labelId = `label-${item.id}`;
              return (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 has-[:checked]:border-accent">
                    <input
                      type="checkbox"
                      checked={checked.has(item.id)}
                      onChange={(e) =>
                        write(toggled(checked, item.id, e.target.checked))
                      }
                      // The name is only the item itself; the hint is a description, not part of the name.
                      aria-labelledby={labelId}
                      aria-describedby={text.hint ? hintId : undefined}
                      className="mt-1 h-5 w-5 shrink-0 accent-accent"
                    />
                    <span className="space-y-0.5">
                      <span id={labelId} className="font-medium">
                        {text.label}
                        {item.essential && (
                          <span className="ml-2 rounded-full border border-fg px-2 py-0.5 text-xs font-semibold">
                            {t("essentialTag")}
                          </span>
                        )}
                      </span>
                      {text.hint && (
                        <span id={hintId} className="block text-sm text-muted">
                          {text.hint}
                        </span>
                      )}
                    </span>
                  </label>
                  {GEAR_LINKS[item.id] && (
                    <Link
                      href={`/safety/gear/${GEAR_LINKS[item.id]}`}
                      className="mt-1 inline-block text-sm text-accent underline print:hidden"
                    >
                      {t("gearLink", {
                        category: tg(
                          `categories.${GEAR_LINKS[item.id]}.name` as "categories.probe.name",
                        ),
                      })}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}

      <p className="text-xs text-muted print:hidden">{t("storageNote")}</p>
    </div>
  );
}
