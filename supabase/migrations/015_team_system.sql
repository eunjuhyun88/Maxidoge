-- ═══════════════════════════════════════════════════════════════
-- Stockclaw — Phase 3: 3v3 Team System Tables
-- ═══════════════════════════════════════════════════════════════

-- ── Team Role Enum ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE team_role_enum AS ENUM ('CAPTAIN', 'SUPPORT_A', 'SUPPORT_B');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE team_match_status_enum AS ENUM ('FORMING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Teams ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  creator_id      uuid NOT NULL,
  tier            text NOT NULL DEFAULT 'DIAMOND',
  lp_pool         int NOT NULL DEFAULT 0,
  win_count       int NOT NULL DEFAULT 0,
  loss_count      int NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_teams_creator ON teams (creator_id);

-- ── Team Members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  role            team_role_enum NOT NULL DEFAULT 'SUPPORT_A',
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);

-- ── Team Matches ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a_id       uuid NOT NULL REFERENCES teams(id),
  team_b_id       uuid REFERENCES teams(id),  -- null until matched
  pair            text NOT NULL,
  status          team_match_status_enum NOT NULL DEFAULT 'FORMING',
  match_ids       uuid[] DEFAULT '{}',     -- 3 arena_match ids (one per member pair)
  team_a_fbs_avg  numeric(6,2),
  team_b_fbs_avg  numeric(6,2),
  winner_team_id  uuid REFERENCES teams(id),
  lp_reward       int NOT NULL DEFAULT 0,
  mega_meeting    jsonb,                   -- 9-agent mega meeting result
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_team_matches_teams ON team_matches (team_a_id, team_b_id);
CREATE INDEX IF NOT EXISTS idx_team_matches_status ON team_matches (status) WHERE status != 'COMPLETED';

-- ── Enable pgvector index if enough data ─────────────────────
-- Uncomment when match_memories reaches 100+ rows:
-- CREATE INDEX IF NOT EXISTS idx_memory_vector ON match_memories
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
