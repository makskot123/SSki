# FreerideAtlas — project conventions

Freeride / off-piste resort guide for Europe: resort ranking, avalanche danger map ("Lawinomierz"), powder forecast, safety tools. Full plan: `PLAN.md`.

## Workflow

- Build **one milestone at a time** (see PLAN.md §6). After each: run lint, typecheck and tests, summarise, then **wait for "NEXT"**.
- Small, focused commits with descriptive messages.

## Stack

Next.js (App Router) · TypeScript strict · Tailwind CSS v4 · next-intl (en, pl) · Zod · MapLibre GL · Open-Meteo · Vitest · Playwright · Node 24 · npm · Vercel.

## Commands

```
npm run dev          # local dev server
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:e2e     # playwright smoke test
npm run format       # prettier
npm run data:regions # rebuild simplified EAWS GeoJSON (added in M6)
```

## Code style

- TypeScript strict. No `any`; parse unknown data with Zod and infer types from schemas (`lib/schemas`).
- Server Components by default; `"use client"` only for interactive parts (map, sliders, checklist, quiz).
- Business logic (scoring, CAAML parsing, freshness, thresholds) lives in pure functions in `lib/` with unit tests.
- All user-facing strings go through next-intl (`messages/en.json`, `messages/pl.json`). Never hard-code UI text.
- Tailwind with design tokens. EAWS danger colours come only from the shared palette constant.
- Accessibility: WCAG AA contrast, keyboard navigation, every map has a list/table alternative.

## Data rules (non-negotiable)

- **Always use a mock-data fallback when an API fails.** Every external call goes through `lib/fetch-with-fallback.ts`, which applies a timeout, `revalidate` caching, Zod validation, and falls back to `data/mocks/*`. Mock data is always labelled "sample data" in the UI.
- **Never scrape sites that forbid it.** Use only official APIs/feeds listed as ✅ in PLAN.md §5; everything else is a link-out. No hotlinking images or webcams.
- Avalanche data older than 24 h, or outside its valid window, shows **"No current data"**, never a stale level.
- Never compute, interpolate or forecast avalanche danger ourselves. Display the official values only.
- Always show the disclaimer near avalanche data: "Not a substitute for the official bulletin. Always read the full bulletin and check conditions on site."
- Show the required attribution for every source (SLF: "WSL Institute for Snow and Avalanche Research SLF" + link; Euregio, Open-Meteo: CC BY 4.0).
- `ENABLE_EAWS_AGGREGATE` stays `false` unless permission has been obtained.

## Secrets

- Secrets live in `.env.local` (git-ignored). Keep `.env.example` up to date with every variable (no real values).
