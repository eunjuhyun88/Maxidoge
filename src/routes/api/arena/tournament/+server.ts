// Stockclaw — Tournament API
// GET  /api/arena/tournament — List active tournaments
// POST /api/arena/tournament — Register for a tournament

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import {
  listActiveTournaments,
  registerTournament,
  isTournamentError,
} from '$lib/server/tournamentService';
import { toBoundedInt } from '$lib/server/apiValidation';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = toBoundedInt(url.searchParams.get('limit'), 20, 1, 100);
    const tournaments = await listActiveTournaments(limit);
    return json({ success: true, tournaments });
  } catch (err: unknown) {
    console.error('[arena/tournament/get]', err);
    return json({ error: 'Failed to fetch tournaments' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const tournamentId = typeof body.tournamentId === 'string' ? body.tournamentId.trim() : '';
    if (!tournamentId) return json({ error: 'tournamentId is required' }, { status: 400 });

    const result = await registerTournament(user.id, tournamentId);
    return json({ success: true, ...result });
  } catch (err: unknown) {
    if (isTournamentError(err)) {
      return json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/tournament/post]', err);
    return json({ error: 'Failed to register for tournament' }, { status: 500 });
  }
};
