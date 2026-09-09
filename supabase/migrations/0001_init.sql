-- Treasure Hunt — core schema
-- Two trust tiers:
--   * anon role: safe, non-privileged reads/writes, locked down by RLS below
--   * service_role (used only from Edge Functions): everything privileged
-- Players must never be able to read a clue's target_location_id or a
-- property location's photo/description before they've been sent there —
-- that data lives in tables anon has no SELECT on at all; players read
-- clues through clue_player_state instead.

create extension if not exists "pgcrypto";

create type game_status as enum ('lobby', 'active', 'paused', 'finished');
create type difficulty_level as enum ('easy', 'medium', 'hard', 'extreme');
create type clue_status as enum ('active', 'solved');
create type host_decision as enum ('pending', 'correct', 'incorrect');

-- A property is a reusable, host-mapped physical space (a hostel, in
-- practice) — independent of any single hunt. A host either creates a new
-- one or reuses an existing one (e.g. the seeded GoStops Auroville demo,
-- or one a colleague already mapped) when setting up a game. Anyone can
-- browse/use a property for a new game; only its creator (holder of
-- host_token) can modify its locations, matching the per-game host_token
-- pattern below.
create table properties (
  id uuid primary key default gen_random_uuid(),
  host_token uuid not null default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table property_locations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  floor text,
  area text,
  host_description text,
  ai_description text,
  tags text[] not null default '{}',
  reference_image_url text,
  safe_for_game boolean not null default true,
  created_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  code text not null unique,
  host_token uuid not null default gen_random_uuid(),
  status game_status not null default 'lobby',
  number_of_teams int not null check (number_of_teams between 1 and 5),
  difficulty difficulty_level not null default 'medium',
  theme text,
  clue_count int not null check (clue_count > 0),
  hints_allowed boolean not null default true,
  final_location_id uuid references property_locations(id),
  show_leaderboard boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  completed_clues int not null default 0,
  hints_used int not null default 0,
  failed_attempts int not null default 0,
  winner boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  nickname text not null,
  joined_at timestamptz not null default now()
);

create table clues (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  sequence int not null,
  target_location_id uuid not null references property_locations(id),
  clue_text text not null,
  hint_text text,
  difficulty difficulty_level not null,
  theme text,
  status clue_status not null default 'active',
  is_final boolean not null default false,
  ai_reasoning text,
  generated_at timestamptz not null default now(),
  solved_at timestamptz,
  unique (team_id, sequence)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  clue_id uuid not null references clues(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  photo_url text not null,
  submitted_at timestamptz not null default now(),
  ai_visual_match numeric,
  host_decision host_decision not null default 'pending',
  host_feedback text,
  reviewed_at timestamptz
);

create table game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Player-safe projection of clues: never exposes target_location_id or
-- ai_reasoning. This is a real table (not a view) kept in sync by the Edge
-- Functions whenever they write to `clues`, because Supabase Realtime
-- replicates table WAL changes — a view has none, so postgres_changes
-- subscriptions can't fire on one. Every write comes from a trusted Edge
-- Function (service role), so keeping this in lockstep with `clues` is a
-- server-side responsibility, not something RLS needs to enforce.
create table clue_player_state (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  sequence int not null,
  clue_text text not null,
  hint_text text,
  status clue_status not null default 'active',
  is_final boolean not null default false,
  generated_at timestamptz not null default now(),
  solved_at timestamptz
);

create index on clue_player_state (team_id, status);

create index on property_locations (property_id);
create index on games (property_id);
create index on teams (game_id);
create index on players (team_id);
create index on clues (game_id);
create index on clues (team_id, status);
create index on submissions (clue_id);
create index on submissions (team_id);
create index on submissions (game_id);
create index on game_events (game_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table properties enable row level security;
alter table property_locations enable row level security;
alter table games enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table clues enable row level security;
alter table clue_player_state enable row level security;
alter table submissions enable row level security;
alter table game_events enable row level security;

-- properties: browsable by anyone (a host picking an existing property to
-- reuse needs to see what's available) — only its name/description, which
-- reveals nothing about specific clue targets. Creation happens through
-- the create-property Edge Function (issues the host_token); no direct
-- anon insert/update, since modification is creator-only.
create policy "properties are readable by anyone" on properties
  for select using (true);

-- property_locations: no anon access at all, same reasoning as before —
-- photos/descriptions must stay hidden from players. Browsing a property's
-- locations (to help a host decide whether to reuse it) and all edits go
-- through Edge Functions (service role); edits additionally check the
-- property's host_token server-side.
--
-- Note: get-property currently has no host_token gate on the *read* side
-- (only writes are creator-restricted, per product decision), so treat
-- location secrecy as "hidden from players' own game clients," not as
-- hardened against a host deliberately inspecting a property they didn't
-- create.

-- games: anon can read minimal public fields needed to join (code lookup,
-- lobby status). No direct writes — creation/status changes go through
-- Edge Functions with the service role.
create policy "games are readable by anyone with the code" on games
  for select using (true);

-- teams: readable by anyone (players need to see the team list to join;
-- host dashboard also reads this way). Creation only while game is in lobby.
create policy "teams are readable by anyone" on teams
  for select using (true);

create policy "teams can be created while game is in lobby" on teams
  for insert with check (
    exists (select 1 from games g where g.id = game_id and g.status = 'lobby')
  );

-- players: readable by anyone on the team's game (host + teammates); anon
-- may insert only their own row while the game is still in lobby.
create policy "players are readable by anyone" on players
  for select using (true);

create policy "players can join while game is in lobby" on players
  for insert with check (
    exists (
      select 1 from teams t join games g on g.id = t.game_id
      where t.id = team_id and g.status = 'lobby'
    )
  );

-- clues: base table has no anon access at all (holds target_location_id +
-- ai_reasoning) — only Edge Functions (service role) read/write it.

-- clue_player_state: the safe projection players actually read and
-- subscribe to in realtime. Readable by anyone; written only by Edge
-- Functions (service role bypasses RLS, so no insert/update policy here).
create policy "clue player state is readable by anyone" on clue_player_state
  for select using (true);

-- submissions: no anon insert policy — rows are created only by the
-- submit-photo Edge Function (service role), which needs to read the
-- clue's target_location_id (anon-inaccessible) to compute an advisory AI
-- visual-match score before the host reviews it. Anon may still read
-- submissions so a player's screen can react in realtime to the host's
-- decision.
create policy "submissions are readable by anyone" on submissions
  for select using (true);

-- game_events: no anon access; written only by Edge Functions.
