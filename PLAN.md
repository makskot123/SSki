# FreerideAtlas — Implementation Plan

Status: **Phase 1 built (M1–M8)**. **Phase 2 scope decided** (3D avalanche map + free installable web app, nothing paid), see [§8](#8-phase-2--3d-avalanche-map-and-free-web-app). **Phase 2 A0–A6 done** (see §8.8). **M8b built without product data** (see M8b notes below); **M9 and M10 done** (M10 with two scope changes, see M10 notes). Nothing is deployed or pushed from here: publishing is the owner's step. **Phase 3 planned** (Google Play app via TWA, on-device tracker, more resorts; no server), see [§9](#9-phase-3--phone-app-google-play-and-on-device-features); B1 in progress.
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
- M7: resort pages show each resort's avalanche state (current / stale / feed has no bulletin / not covered -> link-out / no service) with a deferred region map; `/compare?r=a,b,c` compares up to 3 resorts; ranking cards have a Compare checkbox. Resort pages revalidate every 15 min (the shorter of the forecast and bulletin caches). Coverage by our feeds: 13 of 30 resorts (Tyrol 7, Switzerland 6); 15 link out; Bansko and Gudauri have no EAWS service.
- M8: `/safety` index (five danger levels, verified SLF and ICAR links), checklist (21 items in 3 groups, saved in localStorage, printable, works in memory if storage is blocked), aspect and steepness explainer (interactive compass in aspect and wind modes, 0-60 degree slider with bands and percent grade), 13-question EN/PL quiz. Pure logic in `lib/safety/*`. `avalanches.org` could not be reached from the build machine, so it is not linked. The M8b gear guide will link from the checklist items.
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

// ---------- Gear guide (M8b) ----------
type GearCategory = 'transceiver' | 'probe' | 'shovel' | 'airbag' | 'helmet';

interface GearProduct {
  id: string;                         // 'ortovox-diract-voice'
  category: GearCategory;
  brand: string;
  model: string;
  priceEUR: number;                   // manufacturer RRP, not a shop price
  priceCheckedAt: ISODate;            // shown in the UI; old prices are flagged
  specs: Record<string, number | string | boolean>;   // category-specific, validated per category
  meetsMinimums: boolean;             // derived from specs + category gates (see §4 gear scoring)
  failedMinimums?: string[];          // why not, if it does not
  sourceUrl: string;                  // manufacturer spec page (link out, no copied text/images)
  notes?: LocalizedText;              // short factual notes only
}

interface GearKit {                   // a recommendation, computed, not stored
  id: 'essential' | 'recommended' | 'lightweight';
  items: { category: GearCategory; productId: string }[];
  totalPriceEUR: number;
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
| `/gear` | Gear guide: overview per category with best performance / best value / budget pick, recommended kits, general advice |
| `/gear/[category]` | Full value ranking for one category, performance-vs-price slider, minimum-standard filter, spec table, sources |
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

### Gear value ranking (M8b, documented on the gear pages)
Same transparent approach as the resort ranking, reusing the scoring module.

1. **Minimum standards first (hard gates).** A product that misses a minimum is never ranked or recommended, however cheap. It is listed separately with the reason. The minimums, each with its source cited on the page:
   | Category | Minimum to be ranked |
   |---|---|
   | Transceiver | digital, 3 antennas, 457 kHz, EN 300718 conformity, multiple-burial marking |
   | Probe | ≥ 240 cm, quick-locking assembly |
   | Shovel | metal blade, extendable shaft |
   | Airbag | EN 16716 certified |
   | Helmet | EN 1077 certified |
2. **Performance score 0–100** per category from published specs only (e.g. transceiver: range, search strip width, weight, battery life; probe: length, weight, material; shovel: blade volume, weight, shaft length, hoe mode; airbag: system type and re-deployability, weight, pack volume; helmet: weight, dual EN 1077 + EN 12492, rotational protection). Each criterion is min–max normalised within its category, as for resorts. Missing specs are skipped, not counted as zero.
3. **Value** = performance per euro, combined with performance through a *Performance ↔ Price* slider (default 50/50) and presets: *Best value*, *Best performance*, *Lightest* (ski touring), *Budget*.
4. **Three picks per category**:
   - *Best performance*: the highest performance score.
   - *Best value*: the best value among products with performance ≥ 60.
   - *Budget pick*: the cheapest product that meets the minimums.
5. **Recommended kits**: *Essential* (transceiver + probe + shovel, the best-value combination and its total price), *Recommended* (Essential + helmet + airbag), and *Lightweight* (the touring preset). The always-shown rule: no kit replaces training, and the essential trio is useless unless everyone in the group carries and can use it.

Plain-language recommendations shown with the ranking, each with a cited source (ICAR, national avalanche services, manufacturers): take an avalanche course, practise transceiver searches regularly, check batteries and do a group check before every outing, keep phones and other electronics away from the transceiver, replace damaged probes and shovels, and check airbag cartridge rules before flying. Never shown as our own testing: we rank published specs and RRP, we do not test gear.

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
| Gear specs and RRP (M8b) | Manufacturer product pages | ⚠️ manual curation, link out | No public APIs; shop prices are not scraped. Each product stores its source URL and `priceCheckedAt`; prices older than 12 months are flagged in the UI. Facts only: no copied descriptions or product photos. |
| Gear minimum standards | EN 300718, EN 16716, EN 1077, EN 12492; ICAR / national avalanche service guidance | ⚠️ cited, link out | Used for the hard gates and the advice texts. Each gate shows its source. |

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

**M8b — Gear guide: value ranking and recommendations**
`data/gear.json` with ~6–8 products per category (5 categories, ~35 products), validated by Zod with a spec schema per category. Minimum-standard gates, performance score, value score and presets reuse the scoring module. Pages `/gear` (three picks per category, recommended kits with total price, advice) and `/gear/[category]` (full ranking, performance↔price slider, "show products below minimum standards" toggle with reasons, spec table, source links). The M8 gear checklist links each item to its category. EN/PL.
*AC:* the seed validates and every product has a source URL and a check date. A product that fails a minimum is never ranked or picked (unit test with a deliberately non-compliant fixture). Unit tests cover the value score, the presets, the three picks and the kit totals. Prices older than 12 months show a warning. Pages state that we rank published specs and do not test gear, and that nothing is sponsored. axe reports no violations; Lighthouse ≥ 90 on `/gear`.

*M8b notes (2026-10-22):* the engine, pages (`/safety/gear`, `/safety/gear/[category]`, under Safety as decided), checklist links, unit and e2e tests are done, but `data/gear.json` ships **empty**. Manufacturer pages could not be read reliably from the build machine (script-rendered, region-locked or 404), and retailer listings disagreed on weights and ranges; one current model was under a recall. Publishing unverified specs for avalanche safety gear would break the safety-content rule, so the pages show the minimum standards, criteria, advice and "no products listed yet". Products are added by hand following the README ("Gear guide data"), checked with `npm run data:gear-check`. The ranking UI is tested with fictional fixtures.

**M9 — Trip planner**
Dates + country/region → shortlist ranked by forecast + current score + avalanche level. Printable view (print CSS) with checklist.
*AC:* a planner for dates beyond the forecast horizon clearly says "forecast not yet available".

*M9 notes (2026-10-22):* `/planner` is a plain GET form (dates, country), so it works without JavaScript and every plan is a shareable link. Score = 60% resort score (default weights, computed over all resorts so a country filter changes nobody's score) + 40% forecast snow on the trip days the forecast covers. Sample data or dates beyond the 7-day horizon leave the resort score alone, and the page says "Forecast not yet available for these dates". The avalanche level is today's bulletin, labelled as such; resorts at level 4-5 now are listed last, and that order is computed in the browser with re-checked freshness. Print view: the shortlist plus a blank checklist. Linked from the home page.

**M10 — Routes, reviews & condition reports, polish**
`routes.json` (famous descents, guide flags), reviews and condition reports from mock JSON (form validates with Zod, writes to localStorage in v1 — no server writes), webcam link-outs, README complete, Lighthouse/a11y pass, Vercel deploy.
*AC:* Lighthouse ≥ 90 (perf/a11y/best practices/SEO) on `/`, `/resorts`, `/avalanche`. README lists all sources and attributions.

*M10 notes (2026-10-22):*
- **Reviews and condition reports:** no mock reviews are shown, because invented reviews would read as real people's opinions. Instead each resort page has the visitor's own condition notes (date, snow type, signs of instability, text), validated with Zod and stored only in localStorage. They are never sent, shared or used for any ranking or level (e2e checks that no request is made).
- **Webcams:** official webcam pages for 16 resorts, found from each resort's own homepage and checked to answer 200 with a webcam page. They are shown as link-outs only, never embedded.
- **Routes (`routes.json`):** deferred. Famous descents are serious, often glaciated terrain, and describing them needs sourced, checked facts (access, glacier, guide requirement), which could not be verified here. Backlog.
- **README:** a complete sources and attribution table, including the ERA5 / Copernicus credit, which is now also shown on `/how-we-rank`.
- **Lighthouse:** `/` 98/100/100/100, `/resorts` 95/100/100/100, `/avalanche` 96/100/100/100, `/planner` and resort pages 96/100/100/100.
- **Vercel deploy:** not done from here. Pushing to `main` deploys, and that is the owner's decision.

**Backlog:** Supabase-backed condition reports + moderation, EAWS aggregate (after permission), more languages (DE/FR/IT), AINEVA/TOPR direct feeds if they appear, route GPX (licensing!), historical danger-level stats per resort, gear guide for skis/boots/bindings (needs a fair, non-subjective scoring first), user gear reviews.

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
8. **Gear guide (M8b)**: prices and models change every season, so data goes stale. Mitigated by `priceCheckedAt`, a 12-month warning and RRP only. A ranking can read as an endorsement: we state clearly that it is spec-based, not tested by us and not sponsored. Value must never outrank safety: the minimum-standard gates come before any scoring.

**Open questions (please answer with your approval)**
1. **Commercial or not?** Will the site ever have ads, affiliates or paid features? This decides Open-Meteo/Vercel plans. *Default assumption: non-commercial hobby project.*
2. **EAWS aggregate:** may I draft a permission request email to ALBINA/EAWS (you send it)? *Default: yes, feature flag off until answered.*
3. **Météo-France key:** are you OK creating a free Météo-France API portal account (needed for M5b)? *Default: M5b optional, French resorts link out until then.*
4. **Seed list:** keep the resorts from the prompt and fill to ~30 with my picks (e.g. Zermatt, Disentis, Monterosa/Gressoney, Courmayeur, Les Arcs, Serre Chevalier, Obergurgl, Ischgl, Bad Gastein, Kühtai)? *Default: yes.*
5. **Hosting / domain:** Vercel default subdomain for now? *Default: yes, no custom domain.*
6. **Gear guide scope:** avalanche safety gear + helmets only, with skis/boots in the backlog? *Default: yes.*
7. **Gear links:** plain links to manufacturer pages, no affiliate links? Affiliate links would make the site commercial (see question 1). *Default: no affiliate links.*

---

## 8. Phase 2 — 3D avalanche map and free web app

Direction change (2026-10-21): the avalanche map becomes **3D**, and FreerideAtlas becomes an **installable web app** on phones. Everything built in Phase 1 (data layers, scoring, safety rules, tests) is kept. The non-negotiable data rules still apply: official bulletins only, no level without a current bulletin, sample data never raises alerts.

**Decisions (2026-10-21):**
- **Nothing paid.** No App Store or Google Play apps (no store fees), so route A only: an installable web app (PWA). It is free to build and install.
- **The 3D map stays** (A1, A2), on free map and elevation data.
- **No push notifications.** No backend or database to pay for or maintain; A7 is removed.
- **The website stays** and is the same codebase as the installable app.

### 8.1 What "app" can mean (for the record; route A chosen)

| | A. Installable web app (PWA) | B. Store app with Capacitor 8 | C. Native app with Expo 58 (React Native) |
|---|---|---|---|
| Where users get it | "Install" / "Add to Home Screen" from the website | Google Play and App Store | Google Play and App Store |
| Reuses current code | All of it | The web UI runs inside a native shell | Only `lib/` (scoring, CAAML, freshness, safety logic); every screen is rewritten |
| 3D map | MapLibre GL JS, same as the web | Same, inside the WebView | No documented 3D terrain in `@maplibre/maplibre-react-native` 11.5 (checked); the map would run as a web view inside the app |
| Offline, push, location | Yes (service worker, Web Push incl. iOS 16.4+ home-screen apps, Geolocation API) | Yes, native plugins | Yes, native |
| iOS build from Windows | Not needed | Needs macOS/Xcode: a Mac or a cloud macOS runner | EAS Build compiles iOS in the cloud |
| Cost | Free | Google Play $25 once, Apple $99/year | Same as B |
| Main risk | Not in the stores | Apple may reject a "repackaged website" (guideline 4.2); native features reduce the risk | Largest effort; two UIs to maintain |

**Chosen: A only.** B and C need paid store accounts and were dropped. A works on Android (install from Chrome) and iOS (Add to Home Screen) at no cost.

### 8.2 3D avalanche map

- **Engine:** MapLibre GL JS 6 (already used). Verified in the installed typings: `setTerrain` / `TerrainSpecification`, `SkySpecification`, `raster-dem` sources, `maxPitch`, hillshade and globe.
- **Terrain:** a `raster-dem` source (Terrarium encoding) with `map.setTerrain({ source, exaggeration })`, a hillshade layer for relief and a sky layer. Region colours and outlines are drawn onto the terrain, so the official colouring rule is unchanged: a colour only where a bulletin is current.
- **Camera:** pitch up to ~70°, rotation with the compass enabled in 3D, a 2D/3D toggle (`TerrainControl`) and "fly to region" when a region is selected. `prefers-reduced-motion` means jump instead of fly.
- **Defaults:** 3D on desktop. On phones the default is open question 4. The choice is remembered on the device. Low-memory devices and missing WebGL2 fall back to 2D, and the region list stays the complete non-visual alternative.
- **Performance:** keep the interaction-deferred loading from M6. Elevation tiles load only in 3D. Target: Lighthouse ≥ 90 on first load, unchanged, because the map still does not load before interaction.
- **Resort pages:** the small region map becomes a tilted 3D view centred on the resort, with its region outline on the terrain.
- **Not planned without a separate decision: "critical terrain" shading** (slopes ≥ 30° within the bulletin's aspects and elevations). Coarse elevation data (25–30 m) smooths steep slopes and *under*-estimates steepness, which could hide dangerous terrain. This would need high-resolution data and official slope layers. Candidates to check later, not yet verified: swisstopo "slope over 30°" and IGN slope layers. It is a research spike (A0b) with a go/no-go decision.

### 8.3 Data sources for Phase 2 (checked 2026-10-21)

| Source | What | Status | Notes |
|---|---|---|---|
| **AWS Terrain Tiles** (`elevation-tiles-prod`, Terrarium PNG) | Elevation for 3D terrain and hillshade | ✅ tiles answered (z10 Chamonix, 200) | Open data; sources are public domain / CC BY. The required attribution includes Mapzen, "Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers" and "Austria terrain data © offene Daten Österreichs", among others. Resolution is ~30 m in Europe: good for overview, not for judging slopes. |
| **Mapterhorn** (`tiles.mapterhorn.com`, Terrarium WebP, 512 px) | Higher-resolution elevation (down to 0.25 m in parts of CH/DE) | ⚠️ tiles answered, terms for the hosted endpoint unclear | Code BSD-3. Its source data is openly licensed for every country we cover (checked in `attribution.json`): CH 0.25 m CC0; AT 1 m CC BY 4.0; FR 0.5 m Licence Ouverte 2.0; IT 1 m CC BY / CC0; PL 1 m open government data; SK 1 m CC BY; SE 1 m CC0; elsewhere (BG, GE) Copernicus GLO-30. CORS enabled, 7-day cache. The README and website state no terms or rate limits for the hosted tiles, so it is not used until the maintainer confirms (A0 decision). |
| MapLibre demo terrain (`demotiles.maplibre.org`) | Demo elevation | ❌ for production | Demo only. |
| OpenFreeMap (existing basemap) | Vector basemap in 3D | ✅ already in use | Unchanged. |

### 8.4 Architecture changes for the app

- **Data API:** JSON route handlers `/api/resorts`, `/api/forecasts` and `/api/avalanche` (versioned, Zod-validated, cache headers). The app and the service worker read these instead of server-rendered HTML only. They reuse the existing `lib/` code, and avalanche JSON keeps the freshness rule.
- **Offline (PWA):** a service worker with Serwist (`@serwist/turbopack` 9.5, made for Next's Turbopack). The caching rules:
  - **Cached for offline:** the app shell, safety pages, checklist and quiz.
  - **Network first, with time shown:** forecasts and bulletins. Offline bulletin data still passes the 24-hour rule, so an old cached bulletin shows "No current data", never a level.
  - **Capped tile cache:** map and elevation tiles.
- **Mobile app shell:** in installed / small-screen mode, a bottom tab bar (Resorts, Avalanche, Powder, Safety, More), a full-screen map screen, safe-area insets and larger touch targets. Desktop keeps the current website layout.
- **No notifications** (decided): no server, scheduler or subscription database. The powder alarm and avalanche status are shown when the app is opened.
- **Privacy:** location is used on the device only ("near me", "my region") and never sent or stored. Nothing personal is stored on a server.

### 8.5 Phase 2 milestones

Each milestone still ends with lint, typecheck, unit tests, e2e and axe green, a short summary, then waiting for "NEXT".

**A0 — Decisions and spikes**
Answer §8.7. Confirm the elevation source and its attribution. Measure 3D map frame rate and memory on a mid-range phone and a laptop.
*AC:* the decisions are recorded in this plan. The elevation source is ✅ with its attribution text, and there is a written device budget (pitch, exaggeration, tile limits).

**A1 — 3D avalanche map**
Terrain, hillshade, sky, 2D/3D toggle (remembered), rotation and compass, fly-to on region select, reduced-motion support, 2D fallback, elevation attribution. Colours unchanged: current bulletins only.
*AC:* e2e covers toggling 3D, the remembered choice, region select flying to the region, stale data never coloured in 3D, and the 2D fallback when WebGL2 is missing. Lighthouse ≥ 90 on `/avalanche` (map still deferred). axe clean.

**A2 — 3D resort maps**
A tilted terrain view per resort with its region outline and marker, the same deferred loading and the same freshness rule.
*AC:* the 3 test resorts (CH, Tyrol, PL) show the right state in 3D, and Lighthouse ≥ 90 on resort pages.

**A3 — Data API**
`/api/resorts`, `/api/forecasts` and `/api/avalanche`, sharing the existing `lib/` code, with cache headers and schema tests.
*AC:* contract tests on the JSON shape. Avalanche JSON never contains a level for a stale region, and sample weather data is labelled `"status": "mock"`.

**A4 — Installable app (PWA) and offline mode**
Manifest, icons, Serwist service worker, offline caching (§8.4), an install prompt, an update notice and an offline indicator.
*AC:* the app installs on Android Chrome and as an iOS home-screen app. With the network off, the checklist, quiz and safety pages work, and the last data shows its time. A cached bulletin older than 24 h shows "No current data" (e2e with an offline browser). Lighthouse PWA checks pass.

**A5 — Mobile app shell**
Bottom tab navigation in installed or small-screen mode, a full-screen map screen, safe areas, touch targets ≥ 44 px, and system dark mode by default.
*AC:* e2e on a phone viewport (iPhone and Pixel profiles), axe clean, and no horizontal scrolling.

**A6 — Favourites and location**
Favourite resorts (on the device), a "Near me" list from the device location with permission, and a "My region" bulletin card.
*AC:* works without location permission. The location is never sent to the server (tested by checking the network log), and it is translated (EN/PL).

*A7 (notifications) and A8 (store apps) were removed: they needed a paid backend or store accounts.*

**Remaining Phase 1 milestones, re-ordered to fit the app:** M8b gear guide after A5 (as a tab under Safety), M9 trip planner after A6 (uses favourites and location), M10 polish last.

### 8.6 Phase 2 risks

1. **Device performance and battery:** 3D terrain is heavy on older phones. Mitigated by deferred loading, a 2D default on phones if chosen, tile limits and the list fallback.
2. **Elevation data resolution:** 30 m data must never be presented as slope-accurate. 3D is for orientation, and any slope or critical-terrain shading waits for spike A0b.
3. **Installable web apps on iOS are more limited** than on Android: install is manual ("Add to Home Screen") and storage can be cleared by the system after long non-use. The checklist and favourites live on the device, so the app says so.
4. **Stale data offline:** handled by the existing freshness rule, re-checked with the device clock (downgrade only).
5. **Commercial-use limits still apply** (Open-Meteo, Vercel Hobby) if the app is ever monetised.
6. **Third-party tile hosts** (OpenFreeMap, elevation tiles) can change terms or availability. Mitigated by the plain-background fallback and keeping 2D usable.

### 8.7 Questions for Phase 2

Answered on 2026-10-21: installable web app only, no store apps, no notifications, keep the website, keep the 3D map. Phase 2 is A0–A6 and costs nothing.

Still open, with the default used unless you say otherwise:
- **3D on phones:** on by default, or 2D by default with a 3D button (saves battery and data)? *Default: 2D on phones, 3D on desktop. A0 measurements support this (see §8.8).*
- The gear-guide questions (6, 7 in §7) only matter when M8b starts.

### 8.8 A0 results (measured 2026-10-22)

**Method.** A benchmark page with the real MapLibre 6 build, the real region data and the OpenFreeMap basemap (`tools/map-bench`, raw runs in `tools/map-bench/results/`). The camera starts over the Ötztal/Stubai area (zoom 9.2), waits until the map is idle, then turns 120° and zooms in over 5 seconds while frames and long tasks are counted. Two profiles: *laptop* (1366×768) and *phone* (412×915 at 2.6× pixel density, 4× slower CPU, fast 4G). Two renderers bound the range: this PC's real GPU (RTX 5060 Ti, best case; the GPU is not slowed for the phone profile, so phone results are optimistic) and SwiftShader software rendering (worst case: a device without usable GPU acceleration). **No real phone was measured**; the bench page has an on-screen mode for that (`?overlay=1`, see the tool README).

| Profile / renderer | Config | Ready (idle) | Frame rate while moving | JS heap | Data for the first view |
|---|---|---|---|---|---|
| Laptop, real GPU | 2D | 0.9 s | 60 fps | 38 MB | 5.0 MB |
| Laptop, real GPU | 3D AWS, pitch 60, ×1.3 | 3.5 s | 60 fps | 98 MB | 32.3 MB (DEM 20.0, basemap 9.5) |
| Laptop, real GPU | 3D AWS, pitch 70, ×1.5 | 3.7 s | 60 fps | 104 MB | 36.0 MB |
| Laptop, real GPU | 3D Mapterhorn, pitch 60 | 1.5 s | 60 fps | 159 MB | 26.2 MB (DEM 13.9) |
| Phone, real GPU | 2D | 3.3 s | 60 fps | 26 MB | 4.3 MB |
| Phone, real GPU | 3D AWS, pitch 60, ×1.3 | 10.2 s | 47 fps (worst frame 50 ms) | 73 MB | 22.4 MB |
| Phone, real GPU | 3D AWS, pitch 70, ×1.5 | 8.5 s | 45 fps | 65 MB | 22.5 MB |
| Phone, real GPU | 3D Mapterhorn, pitch 60 | 10.1 s | 54 fps | 93 MB | 20.0 MB |
| Phone, software GL | 2D | 3.8 s | 9 fps | 36 MB | 4.3 MB |
| Phone, software GL | 3D AWS, pitch 60 | 15.6 s | **1.8 fps** | 54 MB | 21.5 MB |

Findings:
1. 3D costs about **6× the data** of 2D for the first view (mostly elevation and the extra basemap tiles that a tilted view shows) and about **3× the time** until the map is ready on a phone.
2. On a decent GPU 3D is smooth (45–60 fps). Without GPU acceleration it is unusable (under 2 fps), while 2D is slow but usable.
3. Raising the elevation zoom from 12 to 14 changed nothing at this view distance, and pitch 70 / exaggeration 1.5 costs about 20% more tiles than pitch 60 / 1.3.
4. Mapterhorn needed fewer, larger tiles (76 vs 155), was ready faster and is much more detailed, at the cost of more memory. It is the best upgrade if its hosting terms allow it.

**Decisions:**
- **Elevation source: AWS Terrain Tiles** (✅). Attribution shown on the map when 3D is on: "Terrain: Mapzen / AWS Terrain Tiles — EU-DEM (Copernicus, funded by the European Union), Austria DGM (© offene Daten Österreichs), SRTM and GMTED2010 (U.S. Geological Survey)". Mapterhorn stays a candidate: ask the maintainer about public use (you can send that request; the address is on mapterhorn.com).
- **Phone default: 2D**, with a 3D button. Desktop default 3D. 3D is not offered (only 2D, with a short explanation) when WebGL2 is missing or the GPU is software-only (the renderer string reports SwiftShader, llvmpipe or similar).
- **Device budget for A1/A2:**
  - Pitch: default 60°, maximum 70°.
  - Exaggeration: 1.3.
  - Elevation source maximum zoom: 12; MapLibre over-zooms beyond that. AWS data is about 25–30 m, so higher zoom adds no detail.
  - One `raster-dem` source shared by terrain and hillshade, if it renders cleanly. The benchmark used two, which can double requests; A1 measures this.
  - Elevation tiles load only after the user switches to 3D. First 3D view on a phone: aim for at most 25 MB of new data and ready within 10 s on fast 4G.
  - Offline tile cache in A4: elevation at most 40 MB, basemap at most 40 MB, least recently used tiles removed first.
- **A1 must keep:** the deferred map load (no change to first-load Lighthouse), the 2D fallback and the region list.

**A1 findings (2026-10-22):**
- Terrain and hillshade use **separate** elevation sources. Sharing one cut elevation requests from 52 to 16 for the test view, but MapLibre warns about it and the screenshot showed a visibly blurred, blobby relief. The extra ~1.4 MB is within budget.
- **The GPU is only probed when the map starts** or 3D is requested. Probing on page load created a WebGL context during hydration and pushed Lighthouse blocking time from ~200 to ~750 ms (score 78). With the deferred probe: 93–95. A unit test guards this.
- The full elevation credit expanded the attribution box over the bottom of the map. The map now shows a short credit with a link (Mapzen / AWS Terrain Tiles, EU-DEM © Copernicus, © offene Daten Österreichs, USGS), and the README holds the full required wording.
- MapLibre's attribution links were distinguishable by colour only (axe: link-in-text-block); they are now underlined.

**A4 findings (2026-10-22):**
- Lighthouse 12 no longer has a PWA category. Installability is checked in e2e instead, with Chrome's own `Page.getInstallabilityErrors` (must be empty). Lighthouse after A4: performance 95–97, accessibility, best practices and SEO 100.
- Serwist only serves an offline fallback that is **precached**, so `/en/offline` and `/pl/offline` are in the precache list with the safety pages (one revision per commit). The MapLibre bundle (~1 MB) and the full region polygons are left out of the install download and cached when the map is first used.
- Serwist reloads the page when the connection returns by default. Chrome's offline emulation fired that during navigations, so pages "bounced" back, and it would also wipe a half-done quiz. It is switched off (`reloadOnOnline={false}`), with an e2e test.
- A new version is never activated behind the visitor's back: an "update available" bar offers a reload.
- The avalanche page shown offline re-checks freshness with the device clock: a page saved two days earlier shows no level (e2e with an offline browser and a moved clock).

**A5 findings (2026-10-22):**
- Phones (under 768 px, including the installed app) get five bottom tabs; wider screens keep the header menu. Polish tab labels are shortened where needed ("Start", "Bezpiecznie").
- Touch targets: a global rule for coarse pointers gives buttons, selects, inputs, sliders and checkbox/radio labels at least 44 px; MapLibre's own controls are left alone. An e2e check measures every control on 15 pages on the iPhone 15 (WebKit) and Pixel 7 (Chromium) profiles.
- Sideways scrolling came from visually hidden table captions (absolutely positioned) escaping their scroll box. All wide tables now use one `TableScroll` wrapper, which is also keyboard-focusable (axe: scrollable-region-focusable on Safari).
- The full-screen map enlarges the same map instance in place (no reload of tiles). Everything behind it is made `inert`, Escape closes it, and focus returns to the button (Safari does not focus buttons on tap, so the hook falls back to it). Opening it starts the map directly.
- The theme toggle's accessible name now starts with its visible word ("Dark mode"), as WCAG 2.5.3 asks. The theme follows the system setting live until the visitor picks one.
- Lighthouse (mobile) after A5: performance 95–96, accessibility, best practices and SEO 100.

**A6 findings (2026-10-22):**
- Favourites are a list of resort slugs in localStorage (`freeride-atlas:favourites:v1`), shared live by every star button and the home page; unknown slugs are dropped. Nothing is stored on the server.
- The "My region" card is the home page's "Your resorts": for each saved resort, the current level of its avalanche region(s) with the source, validity time and the disclaimer, re-checked with the device clock like everywhere else. A resort outside our feeds shows the usual link-out text.
- "Near me" asks for the location only when the button is pressed, uses it once to sort resorts by straight-line distance in the browser, and keeps it neither in storage nor in any request (e2e checks every request and localStorage for the coordinates). Without permission the page says so and links to the full list.
- `AvalancheCell` now shows the source attribution whenever it shows a level (this also fixes the compare table, which lacked it).
- The home page fetches the bulletins (revalidated every 15 min): 21 KB gzipped HTML, Lighthouse performance 98.

## 9. Phase 3 — Phone app (Google Play) and on-device features

Decided 2026-10-22: the goal is a phone app on Google Play later, possibly earning money. Nothing is paid for now.

### 9.1 Scope

**In:** an on-device ski-day tracker (speed, distance, vertical), more resorts outside the Alps, more information per resort, and preparing the existing web app for Google Play.
**Out (needs a server, so it costs money or ongoing work):** friends list, friend location, accounts, cloud sync. These need accounts, a database and careful handling of location data under GDPR. Revisit only if a paid or free-tier backend is accepted.

### 9.2 How the app reaches Google Play

The web app is already installable (A4). Google Play accepts a web app packaged as a **Trusted Web Activity (TWA)**: a small Android wrapper, generated with Google's open-source Bubblewrap tool, that opens the site full screen without a browser bar. This keeps one codebase.
- Cost: the Google Play developer account is a **one-time US$25**, paid only when you decide to publish. Everything up to that point is free.
- Needed from the site: a valid manifest (done), a service worker (done), HTTPS hosting (Vercel), and `/.well-known/assetlinks.json` with the app's signing-key fingerprint, which only exists after the Android package is generated.
- Limits of a TWA: same as the web app. GPS tracking works only while the app is open and on screen (no background tracking). Background tracking would need a native Android app (for example Capacitor with a foreground service), which can come later on the same codebase.

### 9.3 Making money: what has to change first

Earning money makes the project **commercial**, which changes some free terms (section 7, question 1):
- **Open-Meteo:** the free API is non-commercial only. Options: their paid API plan, or self-hosting Open-Meteo (open source). Decide before any income.
- **Vercel Hobby** is non-commercial; a paid plan or another host is needed once commercial.
- **SLF and Euregio bulletins (CC BY 4.0), EAWS regions (CC0), OpenStreetMap data (ODbL):** commercial use is allowed with attribution.
- **OpenFreeMap and AWS Terrain Tiles:** check their terms again before launch.
- **Google Play rules:** a privacy policy page is required (location use must be declared), plus the content rating questionnaire and the data-safety form. The app collects nothing on a server, which keeps these simple.

### 9.4 Milestones

**B1 — Ski-day tracker (on device)**
A "Track" screen: start/pause/stop a ski day; live speed, top speed, distance, descent (vertical metres down), moving time. Uses the browser's location only while the screen is on, keeps the screen awake while tracking (Wake Lock, where supported), and stores finished days on the device only. Pure, unit-tested logic in `lib/tracker` filters GPS noise (inaccurate fixes, impossible jumps).
*AC:* works without a server; no position is ever sent (e2e checks the network); refuses gracefully without permission; unit tests cover the filtering and totals with recorded tracks; clear note that it must not be read while skiing and that top speeds are GPS estimates. EN/PL.

**B2 — Google Play readiness (free part)**
A privacy policy page (what is stored on the device, that nothing is sent, which third parties are contacted: weather, bulletins, map tiles), `/.well-known/assetlinks.json` served from an environment variable, and a short README guide to generating and publishing the TWA with Bubblewrap.
*AC:* privacy page in EN/PL linked from the footer; assetlinks route returns valid JSON when configured and 404 otherwise.

**B3 — More resorts, region by region**
Add resorts outside the Alps in batches (for example North America, Japan, Scandinavia, more of Central Europe), each with facts from official resort sites and its official avalanche service as a link-out. Danger levels on our map stay limited to the feeds we can use.
*AC:* seed validates; every new resort has an official link and an avalanche-service link (or "no service known"); the map and lists handle resorts with no feed.

**B4 — More information per resort**
To be defined with the owner (candidates: lift opening dates, snow depth from open data, piste map and lift status as link-outs).
