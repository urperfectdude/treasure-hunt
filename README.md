# Treasure Hunt

*Explore. Solve. Race.*

A real-time, AI-powered physical treasure hunt. A host maps a reusable
**property** (by photo, typed description, or voice — creator-only to
edit, but anyone can reuse one for a new hunt), then AI generates one clue
at a time based on live game state as players explore and submit photos.
The host is the sole authority on correct/incorrect — only then does AI
generate the next clue. See `.claude/plans` or the conversation history for
the full spec. One example property ("GoStops Auroville") ships pre-seeded
via `supabase/seed.sql`.

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind, a static SPA deployed
  to GitHub Pages via `.github/workflows/deploy.yml`.
- **Backend**: Supabase — Postgres (with RLS), Realtime, Storage, and Edge
  Functions (`supabase/functions/*`) as the server-side compute layer that
  holds the OpenAI key and does every privileged/AI operation.
- **AI**: OpenAI (GPT-4o family) for clue/hint/theme text generation and
  vision (location photo analysis + advisory submission match scoring).

## Getting started

See [`SETUP.md`](./SETUP.md) for connecting a real Supabase project. For
local development against the Supabase local stack:

```
npm install
supabase start      # requires Docker
supabase db reset   # applies supabase/migrations/*
cp .env.example .env  # fill in the local API URL + anon key from `supabase status`
npm run dev
```

## Project layout

```
src/routes/host/     host: pick/create property, map locations, configure + run a hunt, live dashboard, summary
src/routes/player/   player: clue screen, progress, team
src/hooks/           realtime-aware data hooks (Supabase postgres_changes)
src/lib/             Supabase client, Edge Function API wrapper, types
supabase/migrations/ schema + RLS policies + storage buckets
supabase/functions/  Edge Functions — all AI calls and privileged writes
supabase/seed.sql    the seeded "GoStops Auroville" example property
```
