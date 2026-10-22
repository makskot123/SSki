"use client";

import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { GearProductCard } from "@/components/gear/product-card";
import {
  failedMinimums,
  GEAR_PRESET_KEYS,
  GEAR_PRESETS,
  rankCategory,
  sliderBlend,
  type GearPresetKey,
} from "@/lib/gear";
import type { GearCategory, GearProduct } from "@/lib/schemas/gear";

/**
 * Full ranking for one category: presets or a Performance <-> Price slider, and an opt-in list of the
 * products below the minimum standard (shown with the reasons, never ranked).
 */
export function GearRanking({
  category,
  products,
  now,
}: {
  category: GearCategory;
  products: GearProduct[];
  now: string;
}) {
  const t = useTranslations("Gear");
  const sliderId = useId();
  const [preset, setPreset] = useState<GearPresetKey | null>("bestValue");
  const [slider, setSlider] = useState(50);
  const [showBelow, setShowBelow] = useState(false);

  const blend = preset ? GEAR_PRESETS[preset] : sliderBlend(slider);
  const ranked = useMemo(
    () =>
      rankCategory(
        category,
        products,
        preset ? GEAR_PRESETS[preset] : sliderBlend(slider),
      ),
    [category, products, preset, slider],
  );
  const below = products
    .map((p) => ({ product: p, failed: failedMinimums(p) }))
    .filter((x) => x.failed.length > 0);

  if (products.length === 0) {
    return <p className="max-w-3xl">{t("noProducts")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 card p-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{t("presetsLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {GEAR_PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={preset === key}
                onClick={() => setPreset(key)}
                className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-fg"
              >
                {t(`presets.${key}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1">
          <label htmlFor={sliderId} className="text-sm font-semibold">
            {t("slider")}
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={10}
            value={preset ? Math.round(blend.performance * 100) : slider}
            onChange={(e) => {
              setPreset(null);
              setSlider(Number(e.target.value));
            }}
            aria-valuetext={t("sliderValue", {
              performance: slider,
              price: 100 - slider,
            })}
            className="block w-full max-w-md accent-accent"
          />
          {!preset && (
            <p className="text-xs text-muted">
              {t("sliderValue", { performance: slider, price: 100 - slider })}
            </p>
          )}
        </div>
        {below.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showBelow}
              onChange={(e) => setShowBelow(e.target.checked)}
              className="accent-accent"
            />
            {t("showBelow")}
          </label>
        )}
      </div>

      <ol className="grid gap-4 md:grid-cols-2" aria-live="polite">
        {ranked.map((r, i) => (
          <li key={r.product.id}>
            <GearProductCard
              product={r.product}
              now={now}
              rank={i + 1}
              score={r.score}
              performance={r.performance}
              value={r.value}
            />
          </li>
        ))}
      </ol>

      {showBelow && below.length > 0 && (
        <section aria-labelledby="below-title" className="space-y-3">
          <h2 id="below-title" className="text-xl font-semibold">
            {t("belowTitle")}
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {below.map(({ product, failed }) => (
              <li key={product.id}>
                <GearProductCard product={product} now={now} failed={failed} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
