# FreerideAtlas

Freeride / off-piste resort guide for Europe: resort ranking, avalanche danger map ("Lawinomierz"), powder forecast and safety tools. English and Polish.

> **Safety disclaimer:** Not a substitute for the official bulletin. Always read the full bulletin and check conditions on site. This project never computes or forecasts avalanche danger itself; it only displays official bulletins and links to them.

Status: Phase 1 (M1–M10) and Phase 2 (A0–A6: 3D avalanche map, installable app, offline mode, favourites) are built. The gear guide ships without product data until products are verified (see "Gear guide data"), and the descent-routes list from M10 is deferred until it can be sourced (see PLAN.md). See [PLAN.md](PLAN.md) for the roadmap and [CLAUDE.md](CLAUDE.md) for project conventions.

## Setup

Requires Node 24 and npm.

```bash
npm install
cp .env.example .env.local   # optional for now, no secrets needed yet
npm run dev                  # http://localhost:3000 (redirects to /en)
```

## Scripts

| Script                        | What it does                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`                 | Dev server                                                                          |
| `npm run build`               | Production build                                                                    |
| `npm run start`               | Serve the production build                                                          |
| `npm run lint`                | ESLint                                                                              |
| `npm run typecheck`           | Generates Next route types, then `tsc --noEmit`                                     |
| `npm test`                    | Unit tests (Vitest)                                                                 |
| `npm run test:e2e`            | Playwright smoke + axe accessibility tests (builds and serves app)                  |
| `npm run format`              | Prettier                                                                            |
| `npm run data:regions`        | Rebuilds the simplified region polygons and metadata in `public/data`               |
| `npm run data:regions-assign` | Assigns EAWS region ids to every resort in `data/resorts.json`                      |
| `npm run data:snowfall`       | Fills average seasonal snowfall per resort (ERA5, resumable)                        |
| `npm run data:gear-check`     | Checks every gear product's manufacturer link and flags prices older than 12 months |
| `npm run icons`               | Renders the app icons (`public/icons`, `app/icon.png`, `app/apple-icon.png`)        |

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

## Gear guide data

`/safety/gear` ranks avalanche safety gear (transceivers, probes, shovels, airbags, helmets) from `data/gear.json`. The ranking logic is in `lib/gear` and the schema is in `lib/schemas/gear.ts`. **The product list starts empty on purpose.** Add a product only after reading its specs on the manufacturer's own page:

- `sourceUrl`: the manufacturer's spec page (https). It must not be a shop page, and no text or images are copied from it.
- `priceEUR`: the manufacturer's recommended retail price, never a discount price. `priceCheckedAt` is the date you checked it.
- `specs`: published figures only. Leave a field out if the manufacturer does not publish it; it is then skipped in the score.
- Products below the minimum standards (e.g. a probe under 240 cm) may be listed. They are shown only on request, with the reason, and are never ranked or recommended.

Then run `npm test` (validates the file) and `npm run data:gear-check` (link and price-date check).

## Data API (v1)

Read-only JSON used by the installable app and its offline cache. Contracts (Zod) live in `lib/api/contracts.ts`.

| Endpoint                | Content                                                                                                                   | Cached                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `GET /api/v1/resorts`   | All resorts (seed data)                                                                                                   | static, `max-age=3600` |
| `GET /api/v1/forecasts` | 7-day forecasts for every resort; `status` is `live` or `mock` (sample data, never with alerts)                           | 1 h                    |
| `GET /api/v1/avalanche` | Per region: `current` (level, `validUntil`, bulletin) or `stale` (no level, only `publishedAt`); feed status; attribution | 15 min                 |

Responses can be minutes old, so clients must re-check `validUntil` and the 24-hour rule against their own clock before showing a level (the response repeats the rule in `freshnessRule`).

## Data sources and attribution

Every source, what it is used for, its licence, and where the required credit is shown. Sources without an open API or feed are only linked to, never scraped; images and webcams are never embedded.

| Source                                                                                                                                         | Used for                                                       | Licence / terms                                                                       | Credit shown                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Open-Meteo](https://open-meteo.com/) forecast API                                                                                             | 7-day snow, wind and temperature forecasts                     | CC BY 4.0; free tier is non-commercial                                                | Footer on every page                                                        |
| ERA5 reanalysis (Copernicus Climate Change Service) via the [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api) | Average seasonal snowfall per resort (`npm run data:snowfall`) | Copernicus licence; "Contains modified Copernicus Climate Change Service information" | `/how-we-rank`                                                              |
| [avalanche.report](https://avalanche.report/) (Euregio Tyrol, South Tyrol, Trentino), CAAML v6 feed                                            | Avalanche danger levels and bulletins                          | CC BY 4.0                                                                             | Next to every level shown (map panel, resort pages, compare, home, planner) |
| [WSL Institute for Snow and Avalanche Research SLF](https://www.slf.ch/), CAAML v6 feed                                                        | Avalanche danger levels and bulletins (Switzerland)            | CC BY 4.0                                                                             | Next to every level shown                                                   |
| [EAWS regions](https://regions.avalanches.org)                                                                                                 | Region outlines, names and official warning services           | CC0                                                                                   | Not required; credited in this README                                       |
| [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen / Tilezen)                                                           | 3D terrain and hillshade                                       | Per-source terms, see below                                                           | Short credit on the map while 3D is on                                      |
| [OpenFreeMap](https://openfreemap.org)                                                                                                         | Basemap tiles                                                  | Free public instance; data © OpenStreetMap contributors (ODbL)                        | Map attribution control                                                     |
| Official resort and warning-service websites                                                                                                   | Links only (official site, bulletin, webcams)                  | Linked, not copied                                                                    | Link text names the source                                                  |
| SLF and ICAR educational pages                                                                                                                 | Further reading on `/safety` and the gear guide                | Linked, not copied                                                                    | Link text                                                                   |

Full terrain credit, as required by the Tilezen attribution: "Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers"; "Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich"; "United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey"; plus the other notices in the [Tilezen attribution document](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

Avalanche data has no sample-data fallback: if a feed is down or a bulletin is out of date (older than 24 hours or outside its validity window), the region shows "No current data". Resort facts in `data/resorts.json` are editorial estimates unless `lastVerified` is set.
