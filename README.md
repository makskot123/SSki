# FreerideAtlas

Freeride / off-piste resort guide for Europe: resort ranking, avalanche danger map ("Lawinomierz"), powder forecast and safety tools. English and Polish.

> **Safety disclaimer:** Not a substitute for the official bulletin. Always read the full bulletin and check conditions on site. This project never computes or forecasts avalanche danger itself; it only displays official bulletins and links to them.

Status: under construction, built milestone by milestone. See [PLAN.md](PLAN.md) for the roadmap and [CLAUDE.md](CLAUDE.md) for project conventions.

## Setup

Requires Node 24 and npm.

```bash
npm install
cp .env.example .env.local   # optional for now, no secrets needed yet
npm run dev                  # http://localhost:3000 (redirects to /en)
```

## Scripts

| Script                        | What it does                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                 | Dev server                                                                   |
| `npm run build`               | Production build                                                             |
| `npm run start`               | Serve the production build                                                   |
| `npm run lint`                | ESLint                                                                       |
| `npm run typecheck`           | Generates Next route types, then `tsc --noEmit`                              |
| `npm test`                    | Unit tests (Vitest)                                                          |
| `npm run test:e2e`            | Playwright smoke + axe accessibility tests (builds and serves app)           |
| `npm run format`              | Prettier                                                                     |
| `npm run data:regions`        | Rebuilds the simplified region polygons and metadata in `public/data`        |
| `npm run data:regions-assign` | Assigns EAWS region ids to every resort in `data/resorts.json`               |
| `npm run data:snowfall`       | Fills average seasonal snowfall per resort (ERA5, resumable)                 |
| `npm run icons`               | Renders the app icons (`public/icons`, `app/icon.png`, `app/apple-icon.png`) |

First time running e2e: `npx playwright install chromium webkit` (WebKit runs the iPhone profile in `tests/e2e/mobile.spec.ts`).

### Windows: `ERR_SWC_NATIVE_CACHE`

`next-intl` pulls in `@swc/core`, which unpacks a native binary into `%LOCALAPPDATA%\swc`. If that folder's permissions grant write access to another Windows account, SWC refuses to use it and `next dev/build/typegen` fail with `ERR_SWC_NATIVE_CACHE`. Point it at a project-local folder instead (git-ignored):

```powershell
$env:SWC_NATIVE_BINDING_CACHE = "$PWD\.swc-cache"
```

## Installable app (PWA)

FreerideAtlas installs as an app from the browser, free and without an app store:

- **Android / desktop Chrome or Edge:** use the "Install the app" button in the footer, or the browser's install icon.
- **iPhone / iPad:** in Safari, tap Share, then Add to Home Screen.

The service worker (Serwist, `app/sw.ts`, built by `app/serwist/[path]/route.ts`) is only active in production builds (`npm run build && npm run start`). It precaches the safety pages, checklist, quiz and the offline page in both languages, caches other pages as they are visited, and keeps map tiles in capped caches. Offline, avalanche levels are re-checked against the device clock and shown only while the bulletin is valid. A new version waits until the visitor clicks Reload.

## Data API (v1)

Read-only JSON used by the installable app and its offline cache. Contracts (Zod) live in `lib/api/contracts.ts`.

| Endpoint                | Content                                                                                                                   | Cached                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `GET /api/v1/resorts`   | All resorts (seed data)                                                                                                   | static, `max-age=3600` |
| `GET /api/v1/forecasts` | 7-day forecasts for every resort; `status` is `live` or `mock` (sample data, never with alerts)                           | 1 h                    |
| `GET /api/v1/avalanche` | Per region: `current` (level, `validUntil`, bulletin) or `stale` (no level, only `publishedAt`); feed status; attribution | 15 min                 |

Responses can be minutes old, so clients must re-check `validUntil` and the 24-hour rule against their own clock before showing a level (the response repeats the rule in `freshnessRule`).

## Data sources and attribution

Current: weather attribution in the footer only. Sources are added as milestones land; the full verified table is in [PLAN.md §5](PLAN.md).

- Safety education content: EAWS danger scale wording (paraphrased), general avalanche-safety guidance; sources linked on /safety (SLF, ICAR).
- Weather: [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0 (free tier is non-commercial only).
- Avalanche bulletins (shown on /avalanche): Euregio avalanche.report (CC BY 4.0), SLF Switzerland (CC BY 4.0, "WSL Institute for Snow and Avalanche Research SLF"), region polygons from EAWS (CC0).

- Region outlines, names and official warning services: [EAWS regions](https://regions.avalanches.org) (CC0).
- 3D terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen/Tilezen). Full credits of its sources, as required: "Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers"; "Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich"; "United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey"; plus the other notices listed in the [Tilezen attribution document](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). The map shows a short form of this credit while 3D is on.
- Basemap: [OpenFreeMap](https://openfreemap.org), data (c) OpenStreetMap contributors. If it cannot be loaded, the map still works on a plain background.

Sources without a usable open API are linked to, never scraped.
