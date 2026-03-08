-- ═══════════════════════════════════════════════════════════════
-- 0008: Community Social Trading — signal_attachment + comment_count
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Signal attachment: stores trade setup (pair, dir, entry, tp, sl, conf, timeframe, reason)
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS signal_attachment jsonb DEFAULT NULL;

-- Denormalized comment count for fast feed rendering (Phase 2 will use this)
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

-- Copy count: how many users copied this signal
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS copy_count integer NOT NULL DEFAULT 0;

-- Allow copy trading flag
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS allow_copy_trade boolean NOT NULL DEFAULT false;

-- Index for signal-filtered feed queries
CREATE INDEX IF NOT EXISTS idx_community_posts_signal_created_at
  ON community_posts (signal, created_at DESC)
  WHERE signal IS NOT NULL;

-- Index for copy-trade-enabled posts
CREATE INDEX IF NOT EXISTS idx_community_posts_copy_trade
  ON community_posts (allow_copy_trade, created_at DESC)
  WHERE allow_copy_trade = true;

COMMIT;
