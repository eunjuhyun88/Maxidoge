// Stockclaw — LIVE Session API
// POST /api/arena/live/session — Create LIVE session (Diamond+)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getMatch } from '$lib/server/arenaService';
import { createLiveSession } from '$lib/server/liveConnectionManager';

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const matchId = typeof body.matchId === 'string' ? body.matchId.trim() : '';
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    // Verify match ownership
    const match = await getMatch(user.id, matchId);
    if (!match) return json({ error: 'Match not found' }, { status: 404 });

    // TODO: Tier check (Diamond+ required) — skip for now in MVP

    const { sessionId } = await createLiveSession(matchId, user.id, match.pair ?? 'BTC/USDT');

    return json({
      success: true,
      sessionId,
      matchId,
      pair: match.pair,
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/live/session/post]', err);
    return json({ error: 'Failed to create LIVE session' }, { status: 500 });
  }
};
