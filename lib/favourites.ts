/** Favourite resorts live only on the device (localStorage). Versioned so the format can change later. */
export const FAVOURITES_STORAGE_KEY = "freeride-atlas:favourites:v1";

/**
 * Reads the stored list defensively: anything that is not a JSON array of strings is ignored, and with
 * `knownSlugs` so are slugs of resorts that no longer exist.
 * Order is kept (the order in which resorts were saved), duplicates removed.
 */
export function parseFavourites(
  raw: string | null | undefined,
  knownSlugs?: Iterable<string>,
): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = knownSlugs ? new Set(knownSlugs) : null;
    return [
      ...new Set(
        parsed.filter(
          (s): s is string => typeof s === "string" && (!known || known.has(s)),
        ),
      ),
    ];
  } catch {
    return [];
  }
}

/** Adds the slug at the end, or removes it if it is already a favourite. */
export function toggleFavourite(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
}
