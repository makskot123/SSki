import { fetchWithFallback } from "@/lib/fetch-with-fallback";
import type { AvalancheBulletin } from "@/lib/schemas/avalanche";
import { z } from "zod";
import { buildRegionIndex, type RegionStatus } from "./freshness";
import { parseCaamlFeed } from "./normalise";
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "./providers";

export type FeedState = "live" | "unavailable";

export interface AvalancheData {
  index: Map<string, RegionStatus>;
  /** Per provider: whether its feed answered, and how many bulletins it returned. */
  feeds: Record<ProviderId, { state: FeedState; count: number }>;
}

/**
 * Bulletins are safety information, so unlike weather there is deliberately NO sample-data fallback:
 * when a feed is down, its regions have no entry and the UI shows "no current data".
 * Invented danger levels must never be displayed. Revalidates every 15 minutes.
 */
export async function getAvalancheData(
  now: Date = new Date(),
): Promise<AvalancheData> {
  const results = await Promise.all(
    PROVIDER_IDS.map(async (id) => {
      const provider = PROVIDERS[id];
      const { data, status } = await fetchWithFallback<AvalancheBulletin[]>({
        url: provider.feedUrl,
        schema: z.unknown().transform((json) => parseCaamlFeed(json, provider)),
        fallback: () => [],
        revalidate: 900,
        label: `avalanche feed ${id}`,
      });
      return {
        id,
        data,
        state: (status === "live" ? "live" : "unavailable") as FeedState,
      };
    }),
  );

  return {
    index: buildRegionIndex(
      results.flatMap((r) => r.data),
      now,
    ),
    feeds: Object.fromEntries(
      results.map((r) => [r.id, { state: r.state, count: r.data.length }]),
    ) as AvalancheData["feeds"],
  };
}
