// Stockclaw — Team Match API
// POST /api/arena/team/match — Create a team match (queue for opponent)
// GET  /api/arena/team/match — List active team matches

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import {
  createTeamMatch,
  listActiveTeamMatches,
  getTeam,
  isTeamError,
} from '$lib/server/teamService';

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const teamId = url.searchParams.get('teamId')?.trim();
    if (!teamId) return json({ error: 'teamId is required' }, { status: 400 });

    const matches = await listActiveTeamMatches(teamId);
    return json({ success: true, matches });
  } catch (err: unknown) {
    console.error('[arena/team/match/get]', err);
    return json({ error: 'Failed to fetch team matches' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
    const pair = typeof body.pair === 'string' ? body.pair.trim() : '';

    if (!teamId) return json({ error: 'teamId is required' }, { status: 400 });
    if (!pair) return json({ error: 'pair is required' }, { status: 400 });

    // Verify user is a member of this team
    const team = await getTeam(teamId);
    if (!team) return json({ error: 'Team not found' }, { status: 404 });
    if (!team.members.some((m) => m.userId === user.id)) {
      return json({ error: 'You are not a member of this team' }, { status: 403 });
    }

    const match = await createTeamMatch(teamId, pair);
    return json({ success: true, match });
  } catch (err: unknown) {
    if (isTeamError(err)) {
      return json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/team/match/post]', err);
    return json({ error: 'Failed to create team match' }, { status: 500 });
  }
};
