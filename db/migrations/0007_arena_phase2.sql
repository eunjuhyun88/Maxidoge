-- Stockclaw — Arena Phase 2: Game Behavior Tables (B-01)
-- Mirror of supabase/migrations/014_arena_phase2.sql
-- See that file for the full annotated version.

BEGIN;

DO $$ BEGIN CREATE TYPE arena_match_mode_enum AS ENUM ('PVE','PVP','TEAM','TOURNAMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pvp_pool_status_enum AS ENUM ('WAITING','MATCHED','EXPIRED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE decision_action_enum AS ENUM ('BUY','SELL','HOLD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE arena_matches ADD COLUMN IF NOT EXISTS mode arena_match_mode_enum NOT NULL DEFAULT 'PVE';
ALTER TABLE arena_matches ADD COLUMN IF NOT EXISTS emergency_meeting_data jsonb;

CREATE TABLE IF NOT EXISTS match_decision_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  window_n smallint NOT NULL CHECK (window_n BETWEEN 1 AND 6),
  action decision_action_enum NOT NULL,
  price_at numeric(16,8) NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id, window_n)
);

CREATE TABLE IF NOT EXISTS agent_dialogue_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  spec_id text NOT NULL,
  persona_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('LONG','SHORT','NEUTRAL')),
  confidence numeric(5,2) NOT NULL,
  dialogue_text text NOT NULL,
  is_imposter boolean NOT NULL DEFAULT false,
  llm_provider text,
  llm_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, agent_id)
);

CREATE TABLE IF NOT EXISTS pvp_match_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  pair text NOT NULL,
  timeframe text NOT NULL DEFAULT '4h',
  tier tier_enum NOT NULL DEFAULT 'BRONZE',
  draft jsonb NOT NULL,
  status pvp_pool_status_enum NOT NULL DEFAULT 'WAITING',
  match_id uuid REFERENCES arena_matches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE TABLE IF NOT EXISTS arena_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  match_id uuid NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
  pair text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('LONG','SHORT','NEUTRAL')),
  fbs numeric(5,2) NOT NULL,
  is_win boolean NOT NULL,
  draft_summary text NOT NULL DEFAULT '',
  exit_strategy text,
  entry_price numeric(16,8),
  exit_price numeric(16,8),
  price_change_pct numeric(8,4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE TABLE IF NOT EXISTS live_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  reaction text NOT NULL CHECK (reaction IN ('🔥','🧊','🤔','⚡','💀')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
