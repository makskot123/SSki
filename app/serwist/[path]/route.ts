import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createSerwistRoute } from "@serwist/turbopack";

/** Larger files are left to runtime caching. Only the MapLibre bundle exceeds this today. */
const MAX_PRECACHE_FILE_BYTES = 400 * 1024;

// One revision per deploy: when it changes, the precached pages below are fetched again.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() ||
  randomUUID();

/*
 * Pages that must work offline even if they were never opened: the offline fallback and the safety tools
 * (checklist, quiz, explainer), in both languages. Everything else is cached as it is visited.
 */
const OFFLINE_PAGES = [
  "",
  "/offline",
  "/safety",
  "/safety/checklist",
  "/safety/quiz",
  "/safety/aspects",
];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: ["en", "pl"].flatMap((locale) =>
      OFFLINE_PAGES.map((page) => ({ url: `/${locale}${page}`, revision })),
    ),
    // Do not precache the large map assets on install; they are cached when the map is first used.
    globIgnores: ["**/maplibre/**", "**/data/avalanche-regions.json"],
    manifestTransforms: [
      (entries) => ({
        // The MapLibre bundle (~1 MB) and its CSS: not every visitor opens the map.
        manifest: entries.filter(
          (e) => e.size <= MAX_PRECACHE_FILE_BYTES && !/maplibre/i.test(e.url),
        ),
        warnings: [],
      }),
    ],
  });
