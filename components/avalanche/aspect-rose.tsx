import { useTranslations } from "next-intl";
import type { Aspect } from "@/lib/schemas/resort";

const ORDER: Aspect[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const CENTER = 50;

export const point = (radius: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${(CENTER + radius * Math.cos(rad)).toFixed(2)} ${(CENTER + radius * Math.sin(rad)).toFixed(2)}`;
};

/** One 45-degree wedge, centred on the compass direction, between an inner and outer radius. */
export function wedge(index: number, inner = 12, outer = 36): string {
  const start = index * 45 - 22.5;
  const end = start + 45;
  return [
    `M ${point(inner, start)}`,
    `L ${point(outer, start)}`,
    `A ${outer} ${outer} 0 0 1 ${point(outer, end)}`,
    `L ${point(inner, end)}`,
    `A ${inner} ${inner} 0 0 0 ${point(inner, start)}`,
    "Z",
  ].join(" ");
}

/** Compass rose with the affected aspects filled. Reused by the aspect explainer later. */
export function AspectRose({
  aspects,
  size = 72,
}: {
  aspects: Aspect[];
  size?: number;
}) {
  const t = useTranslations("Avalanche");
  const active = new Set(aspects);
  const label = t("aspectRoseLabel", {
    aspects: aspects.length
      ? ORDER.filter((a) => active.has(a)).join(", ")
      : t("noAspects"),
  });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      {ORDER.map((aspect, i) => (
        <path
          key={aspect}
          d={wedge(i)}
          fill={active.has(aspect) ? "var(--fg)" : "none"}
          stroke="var(--muted)"
          strokeWidth={1}
        />
      ))}
      {(
        [
          ["N", 0],
          ["E", 90],
          ["S", 180],
          ["W", 270],
        ] as const
      ).map(([letter, deg]) => {
        const [x, y] = point(45, deg).split(" ");
        return (
          <text
            key={letter}
            x={x}
            y={y}
            fontSize="9"
            fill="var(--muted)"
            textAnchor="middle"
            dominantBaseline="central"
            aria-hidden="true"
          >
            {letter}
          </text>
        );
      })}
    </svg>
  );
}
