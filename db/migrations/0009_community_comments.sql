-- ═══════════════════════════════════════════════════════════════
-- 0009: community_post_comments
-- Phase 2: 시그널 상세 페이지 댓글 시스템
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS community_post_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author       text NOT NULL,
  avatar       text NOT NULL DEFAULT '🐕',
  avatar_color text NOT NULL DEFAULT '#E8967D',
  tier         text NOT NULL DEFAULT 'guest',
  body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 댓글 목록 조회: post_id 기준 + 시간순
CREATE INDEX IF NOT EXISTS idx_comments_post_created
  ON community_post_comments (post_id, created_at ASC);

-- 유저별 댓글 조회 (크리에이터 프로필 등)
CREATE INDEX IF NOT EXISTS idx_comments_user
  ON community_post_comments (user_id, created_at DESC);

COMMIT;
