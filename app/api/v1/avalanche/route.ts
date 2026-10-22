import { buildAvalancheResponse } from "@/lib/api/contracts";
import { getAvalancheData } from "@/lib/avalanche";

// Bulletins change a few times a day; the feeds are cached for 15 minutes. Because the response can be
// minutes old, it carries `validUntil` and the freshness rule, and clients must re-check with their clock.
export const revalidate = 900;

export async function GET() {
  const now = new Date();
  const data = await getAvalancheData(now);
  return Response.json(buildAvalancheResponse(data, now), {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
