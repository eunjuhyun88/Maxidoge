// Stockclaw — Arena Signal Publish API
// POST /api/arena/match/[id]/publish — Publish match result as arena signal

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getMatch } from '$lib/server/arenaService';
import { publishMatchAsSignal } from '$lib/server/arenaSignalBridge';
import { arenaSignalPublishLimiter } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ cookies, params, getClientAddress }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const ip = getClientAddress();
    if (!arenaSignalPublishLimiter.check(ip)) {
      return json({ error: 'Signal publish rate limit exceeded' }, { status: 429 });
    }

    const matchId = params.id;
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    const match = await getMatch(user.id, matchId);
    if (!match) return json({ error: 'Match not found' }, { status: 404 });
    if (match.phase !== 'RESULT') {
      return json({ error: 'Match must be resolved (RESULT phase) to publish as signal' }, { status: 400 });
    }

    // We need the result from the match data
    // Since getMatch returns Partial<MatchState>, we construct MatchResult from stored data
    // The result is stored in the match's `result` jsonb column
    // For now, construct a minimal MatchResult from what we have
    const fbs = 50; // TODO: retrieve from match result jsonb
    const isWin = match.priceChange !== null && match.priceChange !== undefined
      ? (match.userAPrediction?.direction === 'LONG' && match.priceChange > 0) ||
        (match.userAPrediction?.direction === 'SHORT' && match.priceChange < 0)
      : false;

    const result = await publishMatchAsSignal({
      userId: user.id,
      matchId,
      matchResult: {
        winnerId: isWin ? user.id : null,
        resultType: 'normal_win',
        userAScore: { ds: 0, re: 0, ci: 0, fbs },
        userBScore: { ds: 0, re: 0, ci: 0, fbs: 0 },
        userALpDelta: 0,
        userBLpDelta: 0,
        agentBreakdown: [],
      },
      matchState: match,
    });

    if (!result) {
      return json({ error: 'Failed to publish signal (database unavailable)' }, { status: 500 });
    }

    return json({
      success: true,
      signalId: result.signalId,
      signal: result.signal,
    });
  } catch (err: any) {
    console.error('[arena/match/publish/post]', err);
    return json({ error: 'Failed to publish signal' }, { status: 500 });
  }
};
