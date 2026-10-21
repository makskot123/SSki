export interface ChecklistItem {
  id: string;
  /** The rescue kit every person must carry; shown with an "Essential" tag. */
  essential?: boolean;
}

export interface ChecklistGroup {
  id: "gear" | "planning" | "trailhead";
  items: ChecklistItem[];
}

/** Labels and hints live in messages/*.json under Checklist.items.<id>. */
export const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    id: "gear",
    items: [
      { id: "transceiver", essential: true },
      { id: "probe", essential: true },
      { id: "shovel", essential: true },
      { id: "airbag" },
      { id: "helmet" },
      { id: "firstaid" },
      { id: "phone" },
      { id: "headlamp" },
      { id: "navigation" },
      { id: "clothing" },
      { id: "food" },
    ],
  },
  {
    id: "planning",
    items: [
      { id: "bulletin" },
      { id: "weather" },
      { id: "route" },
      { id: "inform" },
      { id: "skills" },
      { id: "daylight" },
    ],
  },
  {
    id: "trailhead",
    items: [
      { id: "groupcheck" },
      { id: "airbagcheck" },
      { id: "agree" },
      { id: "signs" },
    ],
  },
];

export const ALL_ITEM_IDS: string[] = CHECKLIST_GROUPS.flatMap((g) =>
  g.items.map((i) => i.id),
);

/** Versioned so the format can change later without misreading old data. */
export const CHECKLIST_STORAGE_KEY = "freeride-atlas:checklist:v1";

/**
 * Reads the stored value defensively: anything that is not a JSON array of known item ids
 * (corrupt data, old items, a different shape) is ignored rather than trusted.
 */
export function parseChecked(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const known = new Set(ALL_ITEM_IDS);
    return new Set(
      parsed.filter(
        (id): id is string => typeof id === "string" && known.has(id),
      ),
    );
  } catch {
    return new Set();
  }
}

export function serialiseChecked(ids: Iterable<string>): string {
  // Stable order, so the stored string only changes when the selection does.
  const set = new Set(ids);
  return JSON.stringify(ALL_ITEM_IDS.filter((id) => set.has(id)));
}

export function toggled(
  current: ReadonlySet<string>,
  id: string,
  checked: boolean,
): Set<string> {
  const next = new Set(current);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}
