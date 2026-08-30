# RUN QUEST

Production-oriented, mobile-first running adventure game built with Next.js, TypeScript, Tailwind CSS, Supabase, MapLibre GL JS, browser geolocation and deterministic personalization.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open **http://localhost:5173**. The project intentionally keeps the original preview port so an existing RUN QUEST browser preview continues to work after the Next.js migration.

Supabase is required. The application never creates fictional runners, rankings, run spots, parties, or activity when live data is unavailable.

## Architecture

- `src/app` — App Router pages and secure server API routes.
- `src/components` — game UI, auth, maps, profile and PWA components.
- `src/lib/game` — deterministic matchmaking, XP and anti-cheat verification engines.
- `src/lib/personalization` — deterministic Runner DNA, adaptive difficulty, template scoring, cooldown and daily quest engine.
- `src/lib/progression` — reusable multi-objective run evaluation, adaptive Weekly Challenges and Event rules.
- `src/lib/season` — calendar Seasons, personalized monthly Boss targets, configurable Rank thresholds, audited RP caps, soft reset and fairness simulation.
- `src/lib/routing` — routing provider interface for real route services.
- `src/lib/supabase` — required browser and server database clients.
- `supabase/migrations` — relational schema, indexes and Row Level Security.

## Environment

Copy `.env.example` to `.env.local`. Only Supabase, map and routing configuration is required for production services.

## Location safety

Exact GPS points live in the private `run_points` table. Public runner discovery uses approximate distance/geohash only. Public profiles never expose precise starts, ends or live coordinates. GPS points are held in a client batch so a production uploader can write them in sensible intervals instead of one row per second.

## Personalized Quest Engine

Daily quests are produced from reusable templates, Runner DNA, summarized behavior metrics, recent activity windows, cooldown history and adaptive player state. No generative service is used. Supabase-backed installations use `/api/runner-dna` and `/api/personalized-quests`; assignments are persisted in Supabase.

## Monthly Season and Rank

Lifetime XP, Level, runs, distance and achievements never reset. Monthly RP is quest-based, separately capped and determines the current Season Rank. Only verified runs can receive RP. At midnight in Vientiane on the first day of each month, Season Rank and RP reset to Rookie / 0 RP while the finished season is preserved as permanent history.

Apply the additive migrations with `supabase db push`. The progression migration preserves existing profiles, runs, XP and Runner DNA. Run deterministic engine tests with:

```bash
npm test
```

## Production follow-ups

Before a public launch: configure a private map style/tile service and routing provider, apply the Supabase migration, generate database TypeScript types, add server-side rate limiting, enable error monitoring, add real emergency-contact workflows, and run a formal privacy/security review.
