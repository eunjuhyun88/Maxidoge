// Stockclaw — Social Profile API
// GET /api/social/profile/[userId] — Public profile (tier, winRate, signals, followStats)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { query } from '$lib/server/db';
import { getUserArenaSignals } from '$lib/server/arenaSignalBridge';
import type { UserFollowStats } from '$lib/engine/types';

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

export const GET: RequestHandler = async ({ cookies, params }) => {
  try {
    const currentUser = await getAuthUserFromCookies(cookies).catch(() => null);
    const targetUserId = params.userId;
    if (!targetUserId) return json({ error: 'userId is required' }, { status: 400 });

    // Get passport data
    let passport: Record<string, unknown> | null = null;
    try {
      const res = await query<any>(
        `SELECT display_name, win_rate, direction_accuracy, ids_score,
                calibration, guardian_compliance, challenge_win_rate,
                lp_total, tier, tier_level, badges, total_hypotheses,
                win_count, loss_count, current_streak, best_win_streak
         FROM user_passports WHERE user_id = $1`,
        [targetUserId],
      );
      passport = res.rows[0] ?? null;
    } catch (err: unknown) {
      if (!isTableError(err)) console.warn('[social/profile] passport query failed:', err);
    }

    // Get follow stats
    let followStats: UserFollowStats = { followersCount: 0, followingCount: 0, isFollowing: false };
    try {
      const followersRes = await query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM user_follows WHERE following_id = $1`,
        [targetUserId],
      );
      const followingRes = await query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM user_follows WHERE follower_id = $1`,
        [targetUserId],
      );

      followStats.followersCount = Number(followersRes.rows[0]?.cnt ?? '0');
      followStats.followingCount = Number(followingRes.rows[0]?.cnt ?? '0');

      // Check if current user follows target
      if (currentUser) {
        const isFollowingRes = await query<{ cnt: string }>(
          `SELECT count(*)::text AS cnt FROM user_follows
           WHERE follower_id = $1 AND following_id = $2`,
          [currentUser.id, targetUserId],
        );
        followStats.isFollowing = Number(isFollowingRes.rows[0]?.cnt ?? '0') > 0;
      }
    } catch (err: unknown) {
      if (!isTableError(err)) console.warn('[social/profile] follow stats query failed:', err);
    }

    // Get recent signals (top 5)
    const signalResult = await getUserArenaSignals(targetUserId, 5, 0);

    return json({
      success: true,
      userId: targetUserId,
      displayName: passport?.display_name ?? 'Anonymous',
      tier: passport?.tier ?? 'BRONZE',
      tierLevel: passport?.tier_level ?? 1,
      winRate: passport?.win_rate ?? 0,
      lpTotal: passport?.lp_total ?? 0,
      totalMatches: passport?.total_hypotheses ?? 0,
      winCount: passport?.win_count ?? 0,
      lossCount: passport?.loss_count ?? 0,
      currentStreak: passport?.current_streak ?? 0,
      bestWinStreak: passport?.best_win_streak ?? 0,
      badges: passport?.badges ?? [],
      followStats,
      recentSignals: signalResult.signals,
      totalSignals: signalResult.total,
    });
  } catch (err: any) {
    console.error('[social/profile/get]', err);
    return json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
};
