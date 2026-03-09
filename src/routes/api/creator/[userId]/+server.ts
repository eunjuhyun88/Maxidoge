// ═══════════════════════════════════════════════════════════════
// GET /api/creator/[userId] — Public creator profile
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { UUID_RE } from '$lib/server/apiValidation';
import { getUserProfileProjection } from '$lib/server/profileProjection';
import { errorContains } from '$lib/utils/errorUtils';
import { type PostRow, mapPostRow, POST_SELECT_COLUMNS } from '$lib/server/communityMapping';

interface UserRow {
  id: string;
  nickname: string;
  avatar: string | null;
  tier: string;
  created_at: string | null;
}

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const userId = params.userId;
    if (!userId || !UUID_RE.test(userId)) {
      return json({ error: 'Invalid user id' }, { status: 400 });
    }

    // Get current user for userReacted on recent signals
    const currentUser = await getAuthUserFromCookies(cookies).catch(() => null);
    const currentUserId = currentUser?.id ?? null;

    // Fetch user basic info + projection + recent signals + signal count in parallel
    const [userResult, projection, signalsResult, signalCountResult] = await Promise.all([
      query<UserRow>(
        `SELECT id, nickname, avatar, tier, created_at FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      ),
      getUserProfileProjection(userId),
      query<PostRow>(
        `
          SELECT
            ${POST_SELECT_COLUMNS},
            CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS user_reacted
          FROM community_posts p
          LEFT JOIN community_post_reactions r
            ON r.post_id = p.id AND r.user_id = $1 AND r.emoji = '👍'
          WHERE p.user_id = $2
          ORDER BY p.created_at DESC
          LIMIT 20
        `,
        [currentUserId, userId]
      ),
      query<{ count: string }>(
        `SELECT count(*)::text AS count FROM community_posts WHERE user_id = $1`,
        [userId]
      ),
    ]);

    if (!userResult.rowCount) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    const u = userResult.rows[0];

    return json({
      success: true,
      creator: {
        id: u.id,
        nickname: u.nickname,
        avatar: u.avatar || null,
        avatarColor: '#E8967D',
        tier: u.tier,
        joinedAt: u.created_at ? new Date(u.created_at).getTime() : null,
        stats: {
          displayTier: projection.tier,
          totalMatches: projection.totalMatches,
          wins: projection.wins,
          losses: projection.losses,
          winRate: projection.winRate,
          streak: projection.streak,
          bestStreak: projection.bestStreak,
          totalPnl: projection.totalPnl,
          totalLp: projection.totalLp,
          badges: projection.badges,
          signalCount: Number(signalCountResult.rows[0]?.count ?? '0'),
        },
        recentSignals: signalsResult.rows.map(mapPostRow),
      },
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[creator/[userId]/get] unexpected error:', error);
    return json({ error: 'Failed to load creator profile' }, { status: 500 });
  }
};
