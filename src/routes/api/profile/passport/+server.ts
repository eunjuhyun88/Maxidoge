import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { errorContains } from '$lib/utils/errorUtils';
import { syncUserProfileProjection } from '$lib/server/profileProjection';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });
    const [projection, agentSummary] = await Promise.all([
      syncUserProfileProjection(user.id),
      query<{ total_agents: string; avg_level: string }>(
        `SELECT count(*)::text AS total_agents, COALESCE(avg(level), 0)::text AS avg_level FROM agent_stats WHERE user_id = $1`,
        [user.id]
      ),
    ]);

    return json({
      success: true,
      passport: {
        tier: projection.tier,
        totalMatches: projection.totalMatches,
        wins: projection.wins,
        losses: projection.losses,
        streak: projection.streak,
        bestStreak: projection.bestStreak,
        totalLp: projection.totalLp,
        totalPnl: projection.totalPnl,
        badges: projection.badges,
        openTrades: projection.openTrades,
        trackedSignals: projection.trackedSignals,
        winRate: projection.winRate,
        agentSummary: {
          totalAgents: Number(agentSummary.rows[0]?.total_agents ?? '0'),
          avgLevel: Number(agentSummary.rows[0]?.avg_level ?? '0'),
        },
      },
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[profile/passport] unexpected error:', error);
    return json({ error: 'Failed to load passport' }, { status: 500 });
  }
};
