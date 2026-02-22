// MAXI⚡DOGE — Arena Match Resolve
// POST /api/arena/resolve — Resolve a match with exit price

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getMatch, resolveMatch } from '$lib/server/arenaService';

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    const exitPrice = typeof body.exitPrice === 'number' && Number.isFinite(body.exitPrice) ? body.exitPrice : 0;
    if (exitPrice <= 0) return json({ error: 'exitPrice must be a positive number' }, { status: 400 });

    const match = await getMatch(user.id, matchId);
    if (!match) return json({ error: 'Match not found' }, { status: 404 });
    if (!match.entryPrice) return json({ error: 'Match has no entry price (analysis not run)' }, { status: 400 });
    if (!match.userAPrediction) return json({ error: 'Hypothesis not submitted yet' }, { status: 400 });

    const result = await resolveMatch(
      user.id,
      { matchId, exitPrice },
      match.entryPrice,
      match.userAPrediction,
      match.analysisResults ?? [],
    );

    return json({
      success: true,
      result,
      priceChange: match.entryPrice > 0 ? ((exitPrice - match.entryPrice) / match.entryPrice * 100).toFixed(2) + '%' : '0%',
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/resolve/post]', err);
    return json({ error: 'Failed to resolve match' }, { status: 500 });
  }
};
