/** EAWS avalanche danger scale colours (levels 1–5). Single source of truth. */
export const DANGER_COLORS = {
  1: { name: "low", fill: "#ccff66", text: "#1a1a1a" },
  2: { name: "moderate", fill: "#ffff00", text: "#1a1a1a" },
  3: { name: "considerable", fill: "#ff9900", text: "#1a1a1a" },
  4: { name: "high", fill: "#ff0000", text: "#ffffff" },
  5: { name: "very_high", fill: "#1a1a1a", text: "#ffffff" },
} as const;

export type DangerLevel = keyof typeof DANGER_COLORS;
