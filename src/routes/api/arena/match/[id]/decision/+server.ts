// Stockclaw — Arena Decision Window API
// POST /api/arena/match/[id]/decision — Submit BUY/SELL/HOLD for a decision window

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { submitDecisionWindow } from '$lib/server/arenaService';
import { DECISION_WINDOW_COUNT } from '$lib/engine/constants';
import type { DecisionAction } from '$lib/engine/types';

const VALID_ACTIONS: DecisionAction[] = ['BUY', 'SELL', 'HOLD'];

export const POST: RequestHandler = async ({ cookies, request, params }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const matchId = params.id;
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    const body = await request.json();

    // Validate windowN
    const windowN = typeof body.windowN === 'number' ? Math.trunc(body.windowN) : 0;
    if (windowN < 1 || windowN > DECISION_WINDOW_COUNT) {
      return json({ error: `windowN must be 1-${DECISION_WINDOW_COUNT}` }, { status: 400 });
    }

    // Validate action
    const action = typeof body.action === 'string' ? body.action.toUpperCase() as DecisionAction : null;
    if (!action || !VALID_ACTIONS.includes(action)) {
      return json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    // Validate priceAt
    const priceAt = typeof body.priceAt === 'number' && Number.isFinite(body.priceAt) ? body.priceAt : 0;
    if (priceAt <= 0) {
      return json({ error: 'priceAt must be a positive number' }, { status: 400 });
    }

    const result = await submitDecisionWindow(user.id, matchId, windowN, action, priceAt);

    return json({
      success: true,
      window: result.window,
      remainingWindows: DECISION_WINDOW_COUNT - windowN,
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/match/decision/post]', err);
    return json({ error: 'Failed to submit decision' }, { status: 500 });
  }
};
