"use client";

import { useRef } from "react";
import { point, wedge } from "@/components/avalanche/aspect-rose";
import { ASPECT_ORDER } from "@/lib/safety/terrain";
import type { Aspect } from "@/lib/schemas/resort";

/**
 * A compass rose whose eight wedges are a radio group: arrow keys move and select, Space/Enter select.
 * `highlighted` aspects are drawn in the accent colour (e.g. the lee side of the wind).
 */
export function InteractiveRose({
  selected,
  highlighted,
  onSelect,
  label,
  names,
  size = 300,
}: {
  selected: Aspect;
  highlighted: Aspect[];
  onSelect: (aspect: Aspect) => void;
  label: string;
  names: Record<Aspect, string>;
  size?: number;
}) {
  const refs = useRef<(SVGGElement | null)[]>([]);

  function move(from: number, step: number) {
    const next = (from + step + ASPECT_ORDER.length) % ASPECT_ORDER.length;
    onSelect(ASPECT_ORDER[next]);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="max-w-full"
      >
        {ASPECT_ORDER.map((aspect, i) => {
          const isSelected = aspect === selected;
          const isHighlighted = highlighted.includes(aspect);
          const fill = isSelected
            ? "var(--fg)"
            : isHighlighted
              ? "var(--accent)"
              : "var(--surface)";
          const textFill = isSelected
            ? "var(--bg)"
            : isHighlighted
              ? "var(--accent-fg)"
              : "var(--fg)";
          const [tx, ty] = point(29, i * 45).split(" ");
          return (
            <g
              key={aspect}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="radio"
              aria-checked={isSelected}
              aria-label={names[aspect]}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(aspect)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  onSelect(aspect);
                } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  move(i, 1);
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  move(i, -1);
                }
              }}
              className="cursor-pointer focus-visible:outline-none [&:focus-visible>path]:stroke-[3] [&:focus-visible>path]:stroke-[var(--accent)]"
            >
              <path
                d={wedge(i, 9, 40)}
                fill={fill}
                stroke="var(--muted)"
                strokeWidth={1}
              />
              <text
                x={tx}
                y={ty}
                fontSize="7"
                fontWeight="600"
                fill={textFill}
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                aria-hidden="true"
              >
                {aspect}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
