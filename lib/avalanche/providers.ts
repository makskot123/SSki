import type { ProviderInfo } from "@/lib/schemas/avalanche";

export interface FeedProvider extends ProviderInfo {
  /** CAAML v6 JSON feed. */
  feedUrl: string;
  /** Where the full official bulletin can be read. */
  sourceUrl: string;
}

/**
 * Only feeds with a documented open licence (see PLAN.md section 5). Everything else is a link-out.
 * The attribution strings are required by the licences and are shown wherever the data is shown.
 */
export const PROVIDERS = {
  euregio: {
    id: "euregio",
    name: "Avalanche.report (Tyrol, South Tyrol, Trentino)",
    url: "https://avalanche.report/",
    license: "CC BY 4.0",
    feedUrl:
      "https://avalanche.report/bulletins/latest/EUREGIO_en_CAAMLv6.json",
    sourceUrl: "https://avalanche.report/",
  },
  slf: {
    id: "slf",
    name: "WSL Institute for Snow and Avalanche Research SLF",
    url: "https://www.slf.ch/",
    license: "CC BY 4.0",
    feedUrl: "https://aws.slf.ch/api/bulletin/caaml/en/json",
    sourceUrl: "https://www.slf.ch/en/avalanche-bulletin-and-snow-situation/",
  },
} as const satisfies Record<string, FeedProvider>;

export type ProviderId = keyof typeof PROVIDERS;
export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
