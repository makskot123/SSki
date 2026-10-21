import type { ExpressionSpecification } from "maplibre-gl";
import { DANGER_COLORS } from "@/lib/palette";
import type { DangerLevel } from "@/lib/schemas/avalanche";

/** Regions without a current bulletin: neutral grey, never a danger colour. */
export const NO_DATA_FILL = "#8896a5";

/** MapLibre `match` expression colouring each region by its current danger level. */
export function fillColorExpression(
  levels: Record<string, DangerLevel>,
): ExpressionSpecification | string {
  const idsByLevel = new Map<DangerLevel, string[]>();
  for (const [id, level] of Object.entries(levels)) {
    idsByLevel.set(level, [...(idsByLevel.get(level) ?? []), id]);
  }
  if (idsByLevel.size === 0) return NO_DATA_FILL;

  const expression: unknown[] = ["match", ["get", "id"]];
  for (const level of [1, 2, 3, 4, 5] as const) {
    const ids = idsByLevel.get(level);
    if (ids) expression.push(ids, DANGER_COLORS[level].fill);
  }
  expression.push(NO_DATA_FILL);
  return expression as ExpressionSpecification;
}

/** Coloured regions are strongly tinted; grey ones are faint so the basemap stays readable. */
export function fillOpacityExpression(
  levels: Record<string, DangerLevel>,
): ExpressionSpecification | number {
  const ids = Object.keys(levels);
  if (ids.length === 0) return 0.18;
  return [
    "case",
    ["in", ["get", "id"], ["literal", ids]],
    0.72,
    0.18,
  ] as ExpressionSpecification;
}
