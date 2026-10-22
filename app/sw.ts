/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

/*
 * Map tiles get their own capped caches (PLAN.md section 8.8: at most ~40 MB each). They must come BEFORE
 * Serwist's defaults, whose generic image rule would otherwise catch the elevation PNGs.
 * Entry counts approximate the byte budget: elevation tiles average ~130 KB, basemap tiles less.
 */
const tileCaching = [
  {
    matcher: /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\//,
    handler: new CacheFirst({
      cacheName: "terrain-tiles",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 300,
          maxAgeSeconds: 30 * DAY,
          purgeOnQuotaError: true,
        }),
      ],
    }),
  },
  {
    matcher: /^https:\/\/tiles\.openfreemap\.org\//,
    handler: new CacheFirst({
      cacheName: "basemap-tiles",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 400,
          maxAgeSeconds: 14 * DAY,
          purgeOnQuotaError: true,
        }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false, // the app shows "new version available" and lets the visitor reload
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...tileCaching, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: "/pl/offline",
        matcher: ({ request }) =>
          request.destination === "document" &&
          new URL(request.url).pathname.startsWith("/pl"),
      },
      {
        url: "/en/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
