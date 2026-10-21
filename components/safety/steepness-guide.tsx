"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  isCriticalRange,
  slopePercent,
  steepnessBand,
} from "@/lib/safety/terrain";

const MAX_DEG = 60;
const W = 260;
const H = 130;
const BASE_Y = 118;
const X0 = 14;
const LENGTH = 220;

/** Segment edges of the scale bar (degrees) and whether each lies in the 30-45 degree critical range. */
const SCALE = [
  { from: 0, to: 25, critical: false },
  { from: 25, to: 30, critical: false },
  { from: 30, to: 46, critical: true },
  { from: 46, to: MAX_DEG, critical: false },
];

export function SteepnessGuide() {
  const t = useTranslations("Aspects");
  const [deg, setDeg] = useState(35);

  const band = steepnessBand(deg);
  const critical = isCriticalRange(deg);
  const rad = (deg * Math.PI) / 180;
  const endX = X0 + LENGTH * Math.cos(rad);
  const endY = BASE_Y - LENGTH * Math.sin(rad);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="slope-angle" className="block font-medium">
          {t("sliderLabel")}:{" "}
          <output htmlFor="slope-angle">{t("degrees", { deg })}</output>
        </label>
        <input
          id="slope-angle"
          type="range"
          min={0}
          max={MAX_DEG}
          step={1}
          value={deg}
          onChange={(e) => setDeg(Number(e.target.value))}
          aria-valuetext={t("degrees", { deg })}
          className="w-full max-w-xl accent-accent"
        />

        {/* Scale bar: purely visual, the band text below says the same in words. */}
        <div aria-hidden="true" className="max-w-xl">
          <div className="relative flex h-3 overflow-hidden rounded border border-fg/40">
            {SCALE.map((s) => (
              <div
                key={s.from}
                style={{
                  width: `${((s.to - s.from) / MAX_DEG) * 100}%`,
                  background: s.critical ? "var(--accent)" : "var(--border)",
                }}
              />
            ))}
            <div
              className="absolute top-0 h-full w-0.5 bg-fg"
              style={{ left: `${(deg / MAX_DEG) * 100}%` }}
            />
          </div>
          <div className="relative mt-1 h-4 text-xs text-muted">
            {[0, 25, 30, 35, 40, 45, 60].map((mark) => (
              <span
                key={mark}
                className="absolute -translate-x-1/2"
                style={{ left: `${(mark / MAX_DEG) * 100}%` }}
              >
                {mark}°
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[auto_1fr]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={t("diagramLabel", { deg })}
          className="max-w-full rounded-lg border border-border bg-surface"
        >
          <polygon
            points={`${X0},${BASE_Y} ${endX},${BASE_Y} ${endX},${endY}`}
            fill={critical ? "var(--accent)" : "var(--border)"}
            opacity={0.35}
          />
          <line
            x1={X0}
            y1={BASE_Y}
            x2={X0 + LENGTH}
            y2={BASE_Y}
            stroke="var(--muted)"
            strokeWidth={2}
          />
          <line
            x1={X0}
            y1={BASE_Y}
            x2={endX}
            y2={endY}
            stroke="var(--fg)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <text
            x={X0 + 44}
            y={BASE_Y - 8}
            fontSize="13"
            fontWeight="700"
            fill="var(--fg)"
          >
            {deg}°
          </text>
        </svg>

        <div
          aria-live="polite"
          className={`space-y-1 rounded-lg border p-4 ${critical ? "border-2 border-accent bg-surface" : "border-border bg-surface"}`}
        >
          <h3 className="text-lg font-semibold">{t(`bands.${band}.title`)}</h3>
          <p>{t(`bands.${band}.body`)}</p>
          <p className="text-sm text-muted">
            {t("grade", { deg, percent: slopePercent(deg) })}
          </p>
        </div>
      </div>
    </div>
  );
}
