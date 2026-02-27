// Stockclaw — Arena Match Memory API
// POST /api/arena/match/[id]/memory — Store RAG memory for a resolved match

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getMatch } from '$lib/server/arenaService';
import { storeMatchMemories } from '$lib/server/ragMemoryService';

export const POST: RequestHandler = async ({ cookies, request, params }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const matchId = params.id;
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    const body = await request.json();
    const lesson = typeof body.lesson === 'string' ? body.lesson.trim().slice(0, 500) : undefined;

    // Get match state
    const match = await getMatch(user.id, matchId);
    if (!match) return json({ error: 'Match not found' }, { status: 404 });
    if (match.phase !== 'RESULT') return json({ error: 'Match must be resolved (RESULT phase) to store memories' }, { status: 400 });
    if (!match.analysisResults || match.analysisResults.length === 0) {
      return json({ error: 'No analysis results to store as memories' }, { status: 400 });
    }
    if (match.priceChange === null || match.priceChange === undefined) {
      return json({ error: 'Match has no price change data' }, { status: 400 });
    }

    const userPrediction = match.userAPrediction;
    const userWon = userPrediction
      ? (userPrediction.direction === 'LONG' && match.priceChange > 0) ||
        (userPrediction.direction === 'SHORT' && match.priceChange < 0)
      : false;

    const result = await storeMatchMemories({
      userId: user.id,
      matchId,
      pair: match.pair ?? 'BTC/USDT',
      marketRegime: match.marketRegime ?? null,
      agentOutputs: match.analysisResults,
      userDirection: userPrediction?.direction ?? 'NEUTRAL',
      outcome: userWon,
      priceChange: match.priceChange,
      lesson,
    });

    return json({
      success: true,
      stored: result.stored,
      totalAgents: match.analysisResults.length,
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/match/memory/post]', err);
    return json({ error: 'Failed to store match memories' }, { status: 500 });
  }
};
