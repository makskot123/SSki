import { buildForecastsResponse } from "@/lib/api/contracts";
import { getForecasts } from "@/lib/weather";

// Same cadence as the forecast cache behind it.
export const revalidate = 3600;

export async function GET() {
  const now = new Date();
  const { bySlug, status } = await getForecasts(now);
  return Response.json(
    buildForecastsResponse(Object.values(bySlug), status, now),
    {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
      },
    },
  );
}
