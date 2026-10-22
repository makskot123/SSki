import { buildResortsResponse } from "@/lib/api/contracts";
import { getResorts } from "@/lib/resorts";

// Seed data only changes with a deploy.
export const dynamic = "force-static";

export function GET() {
  return Response.json(buildResortsResponse(getResorts(), new Date()), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
