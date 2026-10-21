# FreerideAtlas — Implementation Plan

Status: **DRAFT — awaiting approval** (Stage 1). No application code yet.
Date: 2026-10-21

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (latest stable, App Router)** + **TypeScript (strict)** | SSR/ISR with per-fetch `revalidate` covers our caching rule; first-class on Vercel. |
| Runtime / pkg mgr | **Node 24 LTS**, **npm** | Already installed locally (v24.20 / npm 12). No extra tooling. |
| Styling | **Tailwind CSS v4** | Fast, tokens via CSS variables, so dark mode and EAWS colours come for free. |
| i18n | **next-intl** (EN + PL, `/en/...`, `/pl/...`) | Works with App Router server components; typed messages. |
| Validation | **Zod** | Seed JSON and every external response are parsed with Zod. Unknown shapes go to the mock fallback instead of crashing. |
| Maps | **MapLibre GL JS** (vector) | WebGL handles ~2k avalanche polygons smoothly. Leaflet struggles with that. Free, no key. |
| Basemap tiles | OpenFreeMap (vector) + optional OpenTopoMap raster overlay | `tile.openstreetmap.org` forbids heavy app usage. To be verified in M6. |
| Weather | **Open-Meteo** forecast + historical (ERA5) APIs | Free, no key, has `snowfall`, `freezing_level_height` and wind at a given elevation. |
| Avalanche data | **CAAML v6 JSON** from Euregio + SLF (see §5) | The official EAWS exchange format, so one parser covers many providers. |
| Client state | React state + `localStorage` (checklist, weights) | No global store needed at this size. |
| Tests | **Vitest** (unit), **Playwright** (1 smoke test), **@axe-core/playwright** (a11y in smoke) | As requested. axe is cheap and enforces WCAG AA. |
| Lint/format | ESLint (next config) + Prettier | Standard. |
| Hosting | **Vercel** (Hobby while non-commercial) | Zero-config Next.js. |
| Later DB | Supabase (backlog, condition reports) | Not needed before M10. |

---

**Decisions made while building M1**
- Next.js is 16.4 here and its `create-next-app` enables `cacheComponents` by default. We turned it **off** and use the classic model (`fetch(..., { next: { revalidate } })`), which matches the "revalidate + mock fallback" rule and avoids Suspense constraints.
- Next 16 calls middleware `proxy.ts`; next-intl's locale middleware lives there.
- `@types/node` is 24 (Vitest 5 requires ≥ 22).
- M6: MapLibre's worker cannot be bundled by Next/Turbopack, so it is copied to `public/maplibre/` on dev/build. The map starts on first user interaction (or a button) to keep `/avalanche` at Lighthouse >= 90; the region list and panel work without it. Avalanche feed URLs can be overridden by env so e2e tests can serve recorded real bulletins from a local stub.
- Windows: `@swc/core` (via next-intl) may need `SWC_NATIVE_BINDING_CACHE`, see README.

---

## 2. Folder structure

```
/
├─ app/
│  └─ [locale]/
│     ├─ layout.tsx               # shell, nav, theme, disclaimer footer
│     ├─ page.tsx                 # home: ranking teaser + powder + avalanche map preview
│     ├─ resorts/page.tsx         # ranking + filters + weight sliders
│     ├─ resorts/[slug]/page.tsx  # resort detail
│     ├─ compare/page.tsx         # ?r=chamonix,verbier
│     ├─ avalanche/page.tsx       # Lawinomierz map
│     ├─ avalanche/[regionId]/page.tsx
│     ├─ powder/page.tsx          # "Where is the powder this weekend?"
│     ├─ planner/page.tsx         # trip planner
│     ├─ safety/                  # checklist, aspects explainer, quiz
│     └─ how-we-rank/page.tsx
│  └─ api/                        # thin route handlers (only where client needs live data)
├─ components/
│  ├─ ui/                         # Button, Card, Badge, Slider, Tabs, Disclaimer…
│  ├─ map/                        # MapView, AvalancheLayer, ResortMarkers
│  ├─ avalanche/                  # DangerBadge, AspectRose, ProblemIcon, BulletinPanel
│  ├─ resort/                     # ResortCard, ResortStats, ScoreBreakdown
│  └─ forecast/                   # ForecastTable, PowderAlarmBadge, WindWarning
├─ lib/
│  ├─ schemas/                    # Zod schemas (types inferred from them)
│  ├─ scoring/                    # pure scoring functions + weights presets
│  ├─ weather/                    # open-meteo client, mappers, mock
│  ├─ avalanche/                  # caaml parser, providers/{euregio,slf,…}, freshness, mock
│  ├─ fetch-with-fallback.ts      # shared: revalidate + timeout + Zod + mock fallback
│  └─ geo/                        # point-in-polygon, region lookup
├─ data/
│  ├─ resorts.json                # ~30 resorts (seed)
│  ├─ routes.json
│  ├─ reports.json                # mock condition reports
│  ├─ regions/                    # simplified EAWS micro-regions GeoJSON (build artifact)
│  └─ mocks/                      # sample CAAML + Open-Meteo responses
├─ messages/{en,pl}.json
├─ scripts/
│  ├─ build-regions.ts            # download + simplify EAWS GeoJSON
│  ├─ assign-regions.ts           # resort coords → EAWS region IDs
│  └─ compute-snow-climatology.ts # ERA5 → avg seasonal snowfall per resort
├─ tests/{unit,e2e}/
├─ public/
├─ PLAN.md  CLAUDE.md  README.md  .env.example
```

---

## 3. Data model (TypeScript; in code these are `z.infer<>` of Zod schemas)

```ts
type Aspect = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
type CountryCode = string;            // ISO 3166-1 alpha-2
type ISODate = string;                // YYYY-MM-DD
type ISODateTime = string;

type DangerLevel = 1 | 2 | 3 | 4 | 5;
type AvalancheProblemType =
  | 'new_snow' | 'wind_slab' | 'persistent_weak_layers'
  | 'wet_snow' | 'gliding_snow' | 'cornices' | 'no_distinct_avalanche_problem' | 'favourable_situation';

interface LocalizedText { en: string; pl: string }

interface Resort {
  slug: string;                       // 'chamonix'
  name: string;
  country: CountryCode;
  region: string;                     // 'Haute-Savoie'
  coordinates: { lat: number; lon: number };   // main base
  summitPoint: { lat: number; lon: number; elevation: number }; // for summit forecast
  elevation: { top: number; bottom: number };  // m
  verticalDrop: number;               // m (derived & validated = top − bottom, or longest run)
  offPiste: {
    liftAccessedTerrainHa?: number;   // estimate, may be unknown
    terrainVariety: 1 | 2 | 3 | 4 | 5;     // editorial, see How we rank
    typicalSteepnessDeg: { min: number; max: number };
    mainAspects: Aspect[];
    freerideZones: { name: string; description?: LocalizedText }[]; // marked, ungroomed
    beginnerFriendly: boolean;        // "good for beginners in off-piste"
  };
  guidesAvailable: boolean;
  liftPass: { dayPriceEUR: { min: number; max: number }; season: string /* '2025/26' */ };
  season: { opens: string /* '12-01' MM-DD */; closes: string };
  climatology: { avgSeasonSnowfallCm: number; source: 'era5' | 'resort' };
  avalancheRegionIds: string[];       // EAWS micro-region IDs, e.g. 'AT-07-14-02'
  links: { official: string; avalancheBulletin: string; webcams?: string[] };
  description: LocalizedText;
  lastVerified: ISODate;              // when seed data was checked
}

interface AvalancheRegion {
  id: string;                         // EAWS id 'CH-4231', 'PL-12'
  name: LocalizedText;
  country: CountryCode;
  provider: { name: string; url: string; license?: string };
  // geometry lives in GeoJSON, keyed by id — not duplicated here
}

interface ElevationBand { lowerBound?: number | 'treeline'; upperBound?: number | 'treeline' }

interface AvalancheProblem {
  type: AvalancheProblemType;
  aspects: Aspect[];
  elevation?: ElevationBand;
  validTimePeriod?: 'all_day' | 'earlier' | 'later';
}

interface AvalancheBulletin {
  bulletinId: string;
  regionIds: string[];
  publicationTime: ISODateTime;
  validFrom: ISODateTime;
  validUntil: ISODateTime;
  dangerRatings: { level: DangerLevel; elevation?: ElevationBand; validTimePeriod?: 'all_day' | 'earlier' | 'later' }[];
  maxDangerLevel: DangerLevel;        // derived
  problems: AvalancheProblem[];
  highlights?: string;
  sourceUrl: string;                  // link to the official full bulletin
  provider: { name: string; url: string };
  lang: 'en' | 'de' | 'it' | 'fr' | 'pl';
  dataStatus: 'live' | 'mock';        // mock fallback is always labelled in UI
}
// Derived at render: isCurrent = now ∈ [validFrom, validUntil] && now − publicationTime ≤ 24h.
// Not current → UI shows "No current data", never the old level.

interface SnowForecastDay {
  date: ISODate;
  snowfallCm: number;
  freezingLevelM: number;
  tempMinC: number; tempMaxC: number;           // at summit elevation
  windMaxKmh: number; windGustKmh: number; windDirectionDeg: number;
}
interface SnowForecast {
  resortSlug: string;
  generatedAt: ISODateTime;
  elevationM: number;                 // forecast is downscaled to summit elevation
  days: SnowForecastDay[];            // 7
  past72hSnowfallCm: number;
  next48hSnowfallCm: number;
  powderAlarm: boolean;               // next48h ≥ 20 cm
  windWarning: boolean;               // any day gusts ≥ 60 km/h (threshold in config)
  dataStatus: 'live' | 'mock';
}

interface Route {
  id: string;
  resortSlug: string;
  name: string;                       // 'Vallée Blanche'
  verticalM: number;
  lengthKm?: number;
  difficulty: 1 | 2 | 3 | 4 | 5;      // editorial scale, documented
  maxSteepnessDeg: number;
  aspects: Aspect[];
  exposure: 'low' | 'medium' | 'high';         // fall consequences
  glacier: boolean;
  guideRecommended: boolean;
  description: LocalizedText;
}

interface Review {                    // also used for community condition reports
  id: string;
  resortSlug: string;
  kind: 'review' | 'condition_report';
  date: ISODate;
  author: string;                     // display name, no account in v1
  rating?: 1 | 2 | 3 | 4 | 5;         // review only
  snowQuality?: 'powder' | 'crud' | 'wind_packed' | 'crust' | 'spring' | 'ice';
  avalancheObservations?: string;
  text: string;
  createdAt: ISODateTime;
}
```

---

## 4. Pages and components

**Pages**
| Route | Content |
|---|---|
| `/` | Hero, top-5 ranking, powder alarm strip, avalanche map preview |
| `/resorts` | Ranking table/cards, weight sliders + presets, filters, live re-sort (client-side) |
| `/resorts/[slug]` | Map, stats, score breakdown, 7-day forecast, avalanche level of its region(s), terrain, routes, reviews, webcam links |
| `/compare?r=a,b,c` | 2–3 resorts side by side |
| `/avalanche` | Lawinomierz: map of EAWS regions coloured by level, legend, disclaimer, "no current data" state |
| `/avalanche/[regionId]` | Ratings by elevation, problems, aspect rose, bulletin time, official link |
| `/powder` | Resorts sorted by forecast snowfall Fri–Sun, powder alarm badges, wind warnings |
| `/planner` | Dates + region → shortlist with forecast + avalanche level, printable checklist |
| `/safety/checklist`, `/safety/aspects`, `/safety/quiz` | Gear checklist (localStorage), aspect/steepness explainer, quiz |
| `/how-we-rank` | Scoring formula, weights, data sources, limitations |

**Key components:** `MapView`, `AvalancheLayer`, `ResortMarkers`, `DangerBadge`, `AspectRose` (SVG, interactive), `ProblemIcon`, `BulletinPanel`, `Disclaimer`, `ResortCard`, `ScoreBreakdown`, `WeightSliders`, `FilterBar`, `ForecastTable`, `PowderAlarmBadge`, `WindWarning`, `DataStatusTag` ("live" / "sample data"), `LocaleSwitcher`, `ThemeToggle`.

### Scoring (documented on /how-we-rank)
Each factor is normalised to 0–1 across the resort set (min–max; price and "lower is better" factors inverted). Then:

`score = 100 × Σ(wᵢ × fᵢ) / Σwᵢ`

| Factor | Source | Default weight |
|---|---|---|
| Terrain variety | editorial 1–5 | 3 |
| Vertical drop | seed | 2 |
| Avg seasonal snowfall | ERA5 climatology | 3 |
| Altitude / snow reliability | top elevation + bottom elevation | 2 |
| Steepness | typical max ° | 2 |
| Lift access | lift-accessed off-piste ha (or terrain variety proxy) | 2 |
| Price | day pass max (inverted) | 1 |
| Current conditions | fresh snow last 72 h (Open-Meteo) | 2 |

Presets: *Powder hunter*, *Budget*, *Steep & deep*, *Safety first*. The "Safety" slider is not a ranking of safe resorts. It boosts guide availability and beginner-friendly zones, and **penalises a current avalanche level ≥ 4**. The UI states that a ranking never makes terrain safe.

---

## 5. Data sources (verified 2026-10-21)

| Source | What | Status | Notes |
|---|---|---|---|
| **Open-Meteo Forecast API** | 7-day snowfall, freezing level, temp, wind at summit elevation (`elevation=` param) | ✅ API | Free **for non-commercial use only**: <10k calls/day, CC BY 4.0 attribution. Commercial use needs a paid plan. Tested live: 200 OK. |
| **Open-Meteo Historical (ERA5)** | Avg seasonal snowfall per resort (one-off script) | ✅ API | Same terms. Run once and commit the result to `resorts.json`. |
| **Euregio avalanche.report** (Tyrol, South Tyrol, Trentino) | CAAML v6 JSON, 7 languages, `static.avalanche.report/bulletins/latest/EUREGIO_{lang}_CAAMLv6.json` | ✅ API | Their Open Data page says: "All data provided, such as the avalanche report… are licensed under CC BY 4.0". |
| **SLF Switzerland** | CAAML v6 JSON, `aws.slf.ch/api/bulletin/caaml/{lang}/json` | ✅ API | CC BY 4.0. Required attribution: "WSL Institute for Snow and Avalanche Research SLF" with a link to slf.ch. Returns `{"bulletins":[]}` out of season (verified), so the "no current data" path is needed. |
| **EAWS regions GeoJSON** | Polygons for all micro-regions, `regions.avalanches.org` / gitlab.com/eaws/eaws-regions | ✅ data | CC0. Large, so it is simplified at build time. |
| **EAWS aggregated bulletins** | `static.avalanche.report/eaws_bulletins/{date}/{date}-{PROVIDER}.json` + `{date}.ratings.json` | ⚠️ technically available, permission needed | Verified for 2026-02-15: 16 countries (AT, CH, DE-BY, FR, IT, PL-12 TOPR, SK, CZ, SI, ES, AD, NO, SE, FI, RO, GB), with full CAAML incl. problems and aspects. **Undocumented**, and the content belongs to each national service. Plan: email ALBINA/EAWS for permission. Until they agree it stays behind a feature flag (`ENABLE_EAWS_AGGREGATE=false`). With it off, those regions link out. |
| **Météo-France BERA** | XML bulletin via Météo-France API portal (`DonneesPubliquesBRA`) | ✅ API (free key) | Licence Ouverte / Etalab 2.0. Needs a free account and API key (`.env.local`). XML, not CAAML: needs its own adapter. Key flow to be verified in M5b. Massif ↔ EAWS FR-xx mapping is needed. |
| AINEVA (Italy, other regions) | Website bulletins | ⚠️ link out | No documented public API found. Covered only via the aggregate if permission is granted. |
| Lawinenwarndienst Bayern, Salzburg, Vorarlberg, Carinthia, Styria… | Website bulletins | ⚠️ link out | Same as above (present in the aggregate as DE-BY, AT-xx). |
| **TOPR (lawiny.topr.pl)** | Tatra bulletin | ⚠️ link out | No public API found. Region PL-12 is in the aggregate (provider "Tatrzańskie OPR"). |
| **HZS Slovakia (laviny.sk)** | Bulletin | ⚠️ link out | No public API found. Present in the aggregate (SK). |
| Gudauri (Georgia), Bansko (Bulgaria) | Bulletins | ⚠️ link out / ❌ no EAWS feed | Not in the EAWS aggregate. Show "no data feed — see official source". |
| `tile.openstreetmap.org` | Raster tiles | ❌ for production app | The OSMF tile usage policy forbids heavy or app use. Use OpenFreeMap / OpenTopoMap (fair use, attribution). Verify in M6. |
| Resort stats, lift prices, season dates, freeride zones, routes | Official resort sites | ⚠️ manual curation, link out | No APIs. Curated by hand into seed JSON with `lastVerified`. Facts only, no copied text. |
| Webcams | Resort / third-party sites | ⚠️ link out only | No embedding or hotlinking. |

**Coverage reality:** without the aggregate, live avalanche data covers **Switzerland + Euregio + France (with key)**. That is ≈ 12 of the ~30 seed resorts. The rest show the official link. With aggregate permission, almost all resorts get live data except Gudauri and Bansko.

---

## 6. Milestones

Each milestone finishes with: `npm run lint && npm run typecheck && npm test` green, plus a short summary. Then wait for "NEXT".

**M1 — Scaffold**
`git init`, Next.js + TS strict + Tailwind + ESLint/Prettier + Vitest + Playwright + next-intl (EN/PL). App shell with nav, footer disclaimer, dark mode toggle, design tokens (slate / snow / accent + EAWS palette). `.env.example`, README skeleton, CLAUDE.md.
*AC:* `/en` and `/pl` render with translated nav. Dark mode persists. The smoke test passes. All scripts are green.

**M2 — Resort data + pages (static)**
Zod schemas, `data/resorts.json` with 30 resorts, `/resorts` list and `/resorts/[slug]` detail (stats, links, description). Unit test: seed validates, slugs are unique, vertical = top − bottom (± tolerance).
*AC:* all 30 resorts are reachable via SSG. An invalid seed fails the test.

**M3 — Scoring, sliders, filters, How we rank**
Pure `scoreResorts(resorts, weights, conditions?)`, presets, sliders with live re-sort, filters (country, max price, min altitude, aspect, guides, beginner-friendly), weights in the URL query (shareable). `/how-we-rank` page.
*AC:* unit tests cover normalisation, inversion, zero-weights and ties. Changing a slider re-orders the list without reload.

**M4 — Open-Meteo forecasts + Powder Alarm**
`fetchWithFallback` (timeout, `revalidate: 3600`, Zod, mock). Forecast at summit elevation. 7-day `ForecastTable`, `PowderAlarmBadge`, `WindWarning`. Past-72h snow feeds into the score. `/powder` page (Fri–Sun). Batched multi-location request so 30 resorts = 1 call.
*AC:* with network blocked, the pages render mock data labelled "sample data". Tests cover the powder and wind thresholds.

**M5a — Avalanche data layer**
CAAML v6 Zod schema + normaliser → `AvalancheBulletin`. Providers: Euregio, SLF. Freshness rule (>24 h or outside the valid window → no data). Region lookup for resorts (`scripts/assign-regions.ts`).
*AC:* parser tests on recorded fixtures (incl. empty SLF response, elevation-split ratings, am/pm). The freshness test uses fake timers.

**M5b — Météo-France BERA adapter** *(optional, needs API key; skip if key flow is blocked)*
*AC:* fixture-based parser test. Massif → FR region mapping.

**M6 — Avalanche map (Lawinomierz)**
`build-regions.ts` (simplify to ≤ ~1.5 MB), MapLibre map, regions coloured by max level, grey = no data, click → region panel with `AspectRose`, problems, times, official link, attribution. Disclaimer always visible.
*AC:* keyboard-accessible region list as an alternative to the map. Stale data never coloured. Lighthouse performance ≥ 90 on `/avalanche` (map lazy-loaded).

**M7 — Resort detail integration**
Map with resort + region outline, current avalanche level, forecast, wind → wind-slab hint linking to the avalanche page. Compare page (2–3 resorts).
*AC:* the detail page shows correct live / "no current data" / link-out states for 3 test resorts (CH, AT-Tyrol, PL).

**M8 — Safety education**
Gear checklist (localStorage, printable), aspect & steepness explainer (interactive rose + 30–45° explanation), quiz (10–15 questions, EN/PL).
*AC:* checklist survives reload. Quiz scoring has unit tests. axe reports no violations.

**M9 — Trip planner**
Dates + country/region → shortlist ranked by forecast + current score + avalanche level. Printable view (print CSS) with checklist.
*AC:* a planner for dates beyond the forecast horizon clearly says "forecast not yet available".

**M10 — Routes, reviews & condition reports, polish**
`routes.json` (famous descents, guide flags), reviews and condition reports from mock JSON (form validates with Zod, writes to localStorage in v1 — no server writes), webcam link-outs, README complete, Lighthouse/a11y pass, Vercel deploy.
*AC:* Lighthouse ≥ 90 (perf/a11y/best practices/SEO) on `/`, `/resorts`, `/avalanche`. README lists all sources and attributions.

**Backlog:** Supabase-backed condition reports + moderation, EAWS aggregate (after permission), more languages (DE/FR/IT), PWA/offline, push powder alerts, AINEVA/TOPR direct feeds if they appear, route GPX (licensing!), historical danger-level stats per resort.

---

## 7. Risks and open questions

**Risks**
1. **Commercial use**: the Open-Meteo free tier is non-commercial only. Ads, affiliate links or paid features would require a paid plan (or a self-hosted Open-Meteo).
2. **Avalanche coverage gap** without aggregate permission (see §5). The UI must make "link out" feel deliberate rather than broken.
3. **Liability**: we show safety-relevant data. Mitigations: mandatory disclaimer, staleness rule, always link the official bulletin, never interpolate or forecast danger levels ourselves, SLF's request to keep content correct and current.
4. **Out-of-season testing**: it is October and feeds are mostly empty. All avalanche development uses recorded fixtures (we have Feb 2026 samples available) plus mock mode.
5. **Seed data accuracy**: prices and terrain stats change yearly. Each resort has a `lastVerified` field, and the UI shows "approx." values.
6. **GeoJSON size and map performance** on mobile. Mitigated by build-time simplification, lazy loading and a list fallback.
7. **Vercel Hobby plan** is non-commercial too (same issue as 1).

**Open questions (please answer with your approval)**
1. **Commercial or not?** Will the site ever have ads, affiliates or paid features? This decides Open-Meteo/Vercel plans. *Default assumption: non-commercial hobby project.*
2. **EAWS aggregate:** may I draft a permission request email to ALBINA/EAWS (you send it)? *Default: yes, feature flag off until answered.*
3. **Météo-France key:** are you OK creating a free Météo-France API portal account (needed for M5b)? *Default: M5b optional, French resorts link out until then.*
4. **Seed list:** keep the resorts from the prompt and fill to ~30 with my picks (e.g. Zermatt, Disentis, Monterosa/Gressoney, Courmayeur, Les Arcs, Serre Chevalier, Obergurgl, Ischgl, Bad Gastein, Kühtai)? *Default: yes.*
5. **Hosting / domain:** Vercel default subdomain for now? *Default: yes, no custom domain.*
