import type { z } from "zod";

export type DataStatus = "live" | "mock";

export interface FetchResult<T> {
  data: T;
  status: DataStatus;
}

interface Options<T> {
  url: string;
  /** Validates (and may transform) the JSON body. Anything that fails validation is treated as an outage. */
  schema: z.ZodType<T, unknown>;
  /** Sample data used when the request fails. Always labelled as such in the UI. */
  fallback: () => T;
  /** Seconds the response may be served from Next's data cache. */
  revalidate?: number;
  timeoutMs?: number;
  label?: string;
  /**
   * FORCE_MOCK_DATA=1 only applies to calls that have sample data. Safety-critical feeds without a
   * mock (avalanche bulletins) pass false: they always try the real source and fail to "no data".
   */
  respectForceMock?: boolean;
}

/**
 * Single entry point for external JSON APIs: timeout, `revalidate` caching, Zod validation
 * and a mock fallback. Never throws. Set FORCE_MOCK_DATA=1 to skip the network (tests, offline dev).
 */
export async function fetchWithFallback<T>({
  url,
  schema,
  fallback,
  revalidate = 3600,
  timeoutMs = 8000,
  label = url,
  respectForceMock = true,
}: Options<T>): Promise<FetchResult<T>> {
  if (respectForceMock && process.env.FORCE_MOCK_DATA === "1") {
    return { data: fallback(), status: "mock" };
  }
  try {
    const res = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(
        `unexpected response shape: ${parsed.error.message.slice(0, 300)}`,
      );
    }
    return { data: parsed.data, status: "live" };
  } catch (err) {
    console.warn(
      `[fetchWithFallback] ${label} failed, using sample data:`,
      err,
    );
    return { data: fallback(), status: "mock" };
  }
}
