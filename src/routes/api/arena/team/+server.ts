// Stockclaw — Team API
// GET    /api/arena/team — Get user's teams
// POST   /api/arena/team — Create a new team
// DELETE /api/arena/team — Disband a team (captain only)

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import {
  createTeam,
  getUserTeams,
  joinTeam,
  leaveTeam,
  disbandTeam,
  isTeamError,
} from '$lib/server/teamService';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const teams = await getUserTeams(user.id);
    return json({ success: true, teams });
  } catch (err: unknown) {
    console.error('[arena/team/get]', err);
    return json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : 'create';

    if (action === 'create') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length < 2 || name.length > 20) {
        return json({ error: 'Team name must be 2-20 characters' }, { status: 400 });
      }
      const team = await createTeam({ name, creatorId: user.id });
      return json({ success: true, team });
    }

    if (action === 'join') {
      const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
      if (!teamId) return json({ error: 'teamId is required' }, { status: 400 });
      const member = await joinTeam(teamId, user.id);
      return json({ success: true, member });
    }

    if (action === 'leave') {
      const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
      if (!teamId) return json({ error: 'teamId is required' }, { status: 400 });
      const left = await leaveTeam(teamId, user.id);
      return json({ success: true, left });
    }

    return json({ error: 'Invalid action. Use: create, join, leave' }, { status: 400 });
  } catch (err: unknown) {
    if (isTeamError(err)) {
      return json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/team/post]', err);
    return json({ error: 'Failed to process team action' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';
    if (!teamId) return json({ error: 'teamId is required' }, { status: 400 });

    const disbanded = await disbandTeam(teamId, user.id);
    return json({ success: true, disbanded });
  } catch (err: unknown) {
    if (isTeamError(err)) {
      return json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[arena/team/delete]', err);
    return json({ error: 'Failed to disband team' }, { status: 500 });
  }
};
