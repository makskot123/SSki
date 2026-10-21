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

| Script                        | What it does                                                          |
| ----------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                 | Dev server                                                            |
| `npm run build`               | Production build                                                      |
| `npm run start`               | Serve the production build                                            |
| `npm run lint`                | ESLint                                                                |
| `npm run typecheck`           | Generates Next route types, then `tsc --noEmit`                       |
| `npm test`                    | Unit tests (Vitest)                                                   |
| `npm run test:e2e`            | Playwright smoke + axe accessibility tests (builds and serves app)    |
| `npm run format`              | Prettier                                                              |
| `npm run data:regions`        | Rebuilds the simplified region polygons and metadata in `public/data` |
| `npm run data:regions-assign` | Assigns EAWS region ids to every resort in `data/resorts.json`        |
| `npm run data:snowfall`       | Fills average seasonal snowfall per resort (ERA5, resumable)          |

First time running e2e: `npx playwright install chromium`.

### Windows: `ERR_SWC_NATIVE_CACHE`

`next-intl` pulls in `@swc/core`, which unpacks a native binary into `%LOCALAPPDATA%\swc`. If that folder's permissions grant write access to another Windows account, SWC refuses to use it and `next dev/build/typegen` fail with `ERR_SWC_NATIVE_CACHE`. Point it at a project-local folder instead (git-ignored):

```powershell
$env:SWC_NATIVE_BINDING_CACHE = "$PWD\.swc-cache"
```

## Data sources and attribution

Current: weather attribution in the footer only. Sources are added as milestones land; the full verified table is in [PLAN.md §5](PLAN.md).

- Safety education content: EAWS danger scale wording (paraphrased), general avalanche-safety guidance; sources linked on /safety (SLF, ICAR).
- Weather: [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0 (free tier is non-commercial only).
- Avalanche bulletins (shown on /avalanche): Euregio avalanche.report (CC BY 4.0), SLF Switzerland (CC BY 4.0, "WSL Institute for Snow and Avalanche Research SLF"), region polygons from EAWS (CC0).

- Region outlines, names and official warning services: [EAWS regions](https://regions.avalanches.org) (CC0).
- Basemap: [OpenFreeMap](https://openfreemap.org), data (c) OpenStreetMap contributors. If it cannot be loaded, the map still works on a plain background.

Sources without a usable open API are linked to, never scraped.
