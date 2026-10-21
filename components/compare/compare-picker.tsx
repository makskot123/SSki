"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MAX_COMPARE } from "@/lib/compare";

/** Up to three selects; the selection lives in the URL (?r=a,b,c) so a comparison can be shared. */
export function ComparePicker({
  options,
  selected,
}: {
  options: { slug: string; name: string }[];
  selected: string[];
}) {
  const t = useTranslations("Compare");
  const router = useRouter();

  function change(slot: number, slug: string) {
    const slots = Array.from(
      { length: MAX_COMPARE },
      (_, i) => selected[i] ?? "",
    );
    slots[slot] = slug;
    const next = [...new Set(slots.filter(Boolean))];
    router.replace(next.length ? `/compare?r=${next.join(",")}` : "/compare");
  }

  return (
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: MAX_COMPARE }, (_, i) => (
        <div key={i} className="space-y-1">
          <label htmlFor={`pick-${i}`} className="block text-sm font-medium">
            {t("pick", { n: i + 1 })}
          </label>
          <select
            id={`pick-${i}`}
            value={selected[i] ?? ""}
            onChange={(e) => change(i, e.target.value)}
            className="min-w-48 rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
          >
            <option value="">{t("none")}</option>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
