// Stockclaw — PvP Queue API
// POST /api/arena/pvp/queue — Join queue
// GET /api/arena/pvp/queue — Get queue status
// DELETE /api/arena/pvp/queue — Leave queue

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { joinQueue, leaveQueue, getQueueStatus } from '$lib/server/pvpMatchingService';
import { validateDraft } from '$lib/engine/constants';
import type { Tier } from '$lib/engine/types';

const VALID_TIERS: Tier[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'MASTER'];

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();

    const pair = typeof body.pair === 'string' ? body.pair.toUpperCase().trim() : 'BTC/USDT';
    const timeframe = typeof body.timeframe === 'string' ? body.timeframe.toLowerCase().trim() : '4h';
    const tier = VALID_TIERS.includes(body.tier) ? body.tier as Tier : 'BRONZE';

    // Validate draft
    if (!Array.isArray(body.draft)) {
      return json({ error: 'draft is required (array of DraftSelection)' }, { status: 400 });
    }
    const validation = validateDraft(body.draft);
    if (!validation.valid) {
      return json({ error: validation.errors.join('; '), errors: validation.errors }, { status: 400 });
    }

    const result = await joinQueue(user.id, { pair, timeframe, draft: body.draft, tier });

    return json({
      success: true,
      ...result,
      matched: result.status === 'MATCHED',
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    if (err.message?.includes('Maximum')) return json({ error: err.message }, { status: 429 });
    console.error('[arena/pvp/queue/post]', err);
    return json({ error: 'Failed to join queue' }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const result = await getQueueStatus(user.id);
    return json({ success: true, ...result });
  } catch (err: any) {
    console.error('[arena/pvp/queue/get]', err);
    return json({ error: 'Failed to get queue status' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const poolEntryId = typeof body.poolEntryId === 'string' ? body.poolEntryId.trim() : '';
    if (!poolEntryId) return json({ error: 'poolEntryId is required' }, { status: 400 });

    const success = await leaveQueue(user.id, poolEntryId);
    return json({ success, cancelled: success });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/pvp/queue/delete]', err);
    return json({ error: 'Failed to leave queue' }, { status: 500 });
  }
};
