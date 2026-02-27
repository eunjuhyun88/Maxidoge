// Stockclaw — LIVE Reaction API
// POST /api/arena/live/react — Send danmaku reaction

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { storeLiveReaction } from '$lib/server/liveConnectionManager';
import { liveReactionLimiter } from '$lib/server/rateLimit';
import { LIVE_ALLOWED_REACTIONS } from '$lib/engine/constants';

export const POST: RequestHandler = async ({ cookies, request, getClientAddress }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    // Rate limit
    const ip = getClientAddress();
    if (!liveReactionLimiter.check(ip)) {
      return json({ error: 'Reaction rate limit exceeded' }, { status: 429 });
    }

    const body = await request.json();
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const reaction = typeof body.reaction === 'string' ? body.reaction : '';

    if (!sessionId) return json({ error: 'sessionId is required' }, { status: 400 });
    if (!(LIVE_ALLOWED_REACTIONS as readonly string[]).includes(reaction)) {
      return json({ error: `Invalid reaction. Must be one of: ${LIVE_ALLOWED_REACTIONS.join(', ')}` }, { status: 400 });
    }

    const success = await storeLiveReaction(sessionId, user.id, reaction);

    return json({ success });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/live/react/post]', err);
    return json({ error: 'Failed to send reaction' }, { status: 500 });
  }
};
