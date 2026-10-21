/**
 * EAWS groups micro-regions into "outlines" (a country or state with one warning service),
 * e.g. region "AT-07-14-02" belongs to outline "AT-07", "CH-4231" to "CH".
 * The outline is the longest dash-separated prefix of the region id that is a known outline id.
 */
export function outlineFor(
  regionId: string,
  outlineIds: ReadonlySet<string>,
): string | null {
  const parts = regionId.split("-");
  for (let n = parts.length; n >= 1; n--) {
    const candidate = parts.slice(0, n).join("-");
    if (outlineIds.has(candidate)) return candidate;
  }
  return null;
}
