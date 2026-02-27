// Stockclaw — Tournament Bracket API
// GET /api/arena/tournament/[id]/bracket — Get tournament bracket

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTournamentBracket } from '$lib/server/tournamentService';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const tournamentId = params.id;
    if (!tournamentId) return json({ error: 'Tournament ID is required' }, { status: 400 });

    const bracket = await getTournamentBracket(tournamentId);
    if (!bracket) return json({ error: 'Tournament not found' }, { status: 404 });

    return json({ success: true, ...bracket });
  } catch (err: unknown) {
    console.error('[arena/tournament/bracket/get]', err);
    return json({ error: 'Failed to fetch bracket' }, { status: 500 });
  }
};
