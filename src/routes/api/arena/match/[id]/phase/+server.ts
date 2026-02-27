// Stockclaw — Arena Phase Transition API
// POST /api/arena/match/[id]/phase — Server-authoritative phase advance

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { advancePhase, getPhaseMetadata } from '$lib/server/arenaMatchStateMachine';
import type { MatchPhase } from '$lib/engine/types';

const VALID_PHASES: MatchPhase[] = ['DRAFT', 'ANALYSIS', 'HYPOTHESIS', 'BATTLE', 'RESULT'];

export const POST: RequestHandler = async ({ cookies, request, params }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const matchId = params.id;
    if (!matchId) return json({ error: 'matchId is required' }, { status: 400 });

    const body = await request.json();
    const targetPhase = typeof body.targetPhase === 'string' ? body.targetPhase as MatchPhase : null;
    if (!targetPhase || !VALID_PHASES.includes(targetPhase)) {
      return json({ error: `Invalid targetPhase. Must be one of: ${VALID_PHASES.join(', ')}` }, { status: 400 });
    }

    const result = await advancePhase(matchId, user.id, targetPhase);
    if (!result.valid) {
      return json({ error: result.errors.join('; '), errors: result.errors }, { status: 400 });
    }

    const metadata = getPhaseMetadata(targetPhase);

    return json({
      success: true,
      phase: result.phase,
      expiresAt: result.expiresAt,
      metadata,
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/match/phase/post]', err);
    return json({ error: 'Failed to advance phase' }, { status: 500 });
  }
};
