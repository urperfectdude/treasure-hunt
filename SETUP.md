# Setup

The frontend is a static site (deployable to GitHub Pages); Supabase
provides the database, realtime, storage, and the Edge Functions that hold
the OpenAI key server-side. Nothing here has been provisioned yet — this is
the checklist to connect a real Supabase project.

## 1. Create the Supabase project

Via the [dashboard](https://supabase.com/dashboard) or the CLI:

```
npx supabase login
npx supabase projects create gostops-treasure-hunt
```

Note the project ref, database password, and (from Project Settings → API)
the **Project URL** and **anon public key**.

## 2. Link and push the schema

```
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # applies supabase/migrations/*.sql
```

This creates all tables/RLS policies and the two storage buckets
(`location-photos`, `submission-photos`) with their policies.
`db push` doesn't run `supabase/seed.sql` against a hosted project, so also
paste its contents into the SQL Editor in the Supabase dashboard and run it
once — this seeds one ready-to-use example property ("GoStops Auroville").

## 3. Deploy the Edge Functions

```
npx supabase functions deploy create-property
npx supabase functions deploy list-properties
npx supabase functions deploy get-property
npx supabase functions deploy add-location-to-property
npx supabase functions deploy update-property-location
npx supabase functions deploy create-game
npx supabase functions deploy start-game
npx supabase functions deploy generate-next-clue
npx supabase functions deploy submit-photo
npx supabase functions deploy review-submission
npx supabase functions deploy adjust-clue
npx supabase functions deploy generate-hint
npx supabase functions deploy game-control
npx supabase functions deploy host-snapshot
```

(Or `npx supabase functions deploy` with no name to deploy all of them.)

## 4. Set Edge Function secrets

```
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set ALLOWED_ORIGIN=https://<your-username>.github.io
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to
Edge Functions automatically — no need to set those.

For local dev, set `ALLOWED_ORIGIN` to `http://localhost:5173` instead (or
omit it entirely, which allows any origin — fine for local dev, not for
production).

## 5. Configure the frontend

```
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.

```
npm install
npm run dev
```

## 6. Configure GitHub Pages deployment

In the repo's Settings → Pages, set the source to "GitHub Actions" (the
workflow at `.github/workflows/deploy.yml` handles the rest on every push
to `main`).

In Settings → Secrets and variables → Actions, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If the repo is ever renamed from `treasure-hunt`, update the `base` path in
`vite.config.ts` to match.

## 7. Smoke test

1. `/host` → pick the seeded "GoStops Auroville" property (or create your
   own and map a location by photo, typed description, or voice), then
   create a hunt against it.
2. Start the hunt, join from a second browser/device via the QR code or
   game code.
3. Solve the clue, submit a photo, approve it from the host dashboard, and
   confirm the next clue appears on the player screen without a refresh.
4. On the summary screen after a game ends, try Share Results and New Game.

Note: voice-recorded locations are transcribed via the same OpenAI key
(Whisper) — no separate setup needed, but it does mean `getUserMedia`
requires a secure context (works on `localhost` and the GitHub Pages
`https://` deploy, not on a plain `http://` LAN address).
