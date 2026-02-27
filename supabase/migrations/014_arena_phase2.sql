-- ═══════════════════════════════════════════════════════════════
-- Stockclaw — Arena Phase 2: Game Behavior Tables (B-01)
-- Emergency Meeting, Decision Windows, PvP Pool, Social, LIVE
-- ═══════════════════════════════════════════════════════════════
BEGIN;

-- ─── New Enums ─────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE arena_match_mode_enum AS ENUM ('PVE','PVP','TEAM','TOURNAMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pvp_pool_status_enum AS ENUM ('WAITING','MATCHED','EXPIRED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE decision_action_enum AS ENUM ('BUY','SELL','HOLD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── ALTER arena_matches: add mode + emergency_meeting_data ─
ALTER TABLE arena_matches
  ADD COLUMN IF NOT EXISTS mode arena_match_mode_enum NOT NULL DEFAULT 'PVE';
ALTER TABLE arena_matches
  ADD COLUMN IF NOT EXISTS emergency_meeting_data jsonb;

-- ═════════════════════════════════════════════════════════════
-- 1. match_decision_windows — 6회 BUY/SELL/HOLD 기록
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS match_decision_windows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  window_n    smallint NOT NULL CHECK (window_n BETWEEN 1 AND 6),
  action      decision_action_enum NOT NULL,
  price_at    numeric(16,8) NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id, window_n)
);
CREATE INDEX IF NOT EXISTS idx_dw_match
  ON match_decision_windows (match_id, user_id);

-- ═════════════════════════════════════════════════════════════
-- 2. agent_dialogue_cache — Emergency Meeting LLM 결과 캐시
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_dialogue_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    uuid NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
  agent_id    text NOT NULL,
  spec_id     text NOT NULL,
  persona_name text NOT NULL,
  direction   text NOT NULL CHECK (direction IN ('LONG','SHORT','NEUTRAL')),
  confidence  numeric(5,2) NOT NULL,
  dialogue_text text NOT NULL,
  is_imposter boolean NOT NULL DEFAULT false,
  llm_provider text,
  llm_model   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, agent_id)
);

-- ═════════════════════════════════════════════════════════════
-- 3. pvp_match_pool — PvP 비동기 매칭 대기열
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pvp_match_pool (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  pair        text NOT NULL,
  timeframe   text NOT NULL DEFAULT '4h',
  tier        tier_enum NOT NULL DEFAULT 'BRONZE',
  draft       jsonb NOT NULL,       -- DraftSelection[]
  status      pvp_pool_status_enum NOT NULL DEFAULT 'WAITING',
  match_id    uuid REFERENCES arena_matches(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
CREATE INDEX IF NOT EXISTS idx_pvp_pool_waiting
  ON pvp_match_pool (pair, tier, status) WHERE status = 'WAITING';
CREATE INDEX IF NOT EXISTS idx_pvp_pool_user
  ON pvp_match_pool (user_id, status);

-- ═════════════════════════════════════════════════════════════
-- 4. arena_signals — 매치 결과 자동 발행 시그널
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS arena_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  match_id    uuid NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
  pair        text NOT NULL,
  direction   text NOT NULL CHECK (direction IN ('LONG','SHORT','NEUTRAL')),
  fbs         numeric(5,2) NOT NULL,
  is_win      boolean NOT NULL,
  draft_summary text NOT NULL DEFAULT '',
  exit_strategy text,
  entry_price numeric(16,8),
  exit_price  numeric(16,8),
  price_change_pct numeric(8,4),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_arena_signals_user
  ON arena_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arena_signals_pair
  ON arena_signals (pair, created_at DESC);

-- ═════════════════════════════════════════════════════════════
-- 5. user_follows — 소셜 팔로우
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_follows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON user_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following
  ON user_follows (following_id);

-- ═════════════════════════════════════════════════════════════
-- 6. live_reactions — 탄막 리액션 로그
-- ═════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS live_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id),
  reaction    text NOT NULL CHECK (reaction IN ('🔥','🧊','🤔','⚡','💀')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_live_reactions_session
  ON live_reactions (session_id, created_at DESC);

-- ─── LP reason enum extension ──────────────────────────────
-- Add new LP reasons for PvP, LIVE, signals
DO $$
BEGIN
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'pvp_win';
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'pvp_loss';
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'team_win';
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'team_loss';
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'tournament_win';
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'tournament_loss';
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'live_bonus';
  ALTER TYPE lp_reason_enum ADD VALUE IF NOT EXISTS 'signal_publish';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Update view ─────────────────────────────────────────
CREATE OR REPLACE VIEW arena_matches_v AS
  SELECT *,
    COALESCE(phase, status) AS current_phase
  FROM arena_matches;

COMMIT;
