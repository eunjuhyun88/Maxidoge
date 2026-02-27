// Stockclaw — Team Match Detail API
// GET /api/arena/team/match/[id] — Get team match details

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTeamMatch } from '$lib/server/teamService';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const teamMatchId = params.id;
    if (!teamMatchId) return json({ error: 'Team match ID is required' }, { status: 400 });

    const match = await getTeamMatch(teamMatchId);
    if (!match) return json({ error: 'Team match not found' }, { status: 404 });

    return json({ success: true, match });
  } catch (err: unknown) {
    console.error('[arena/team/match/id/get]', err);
    return json({ error: 'Failed to fetch team match' }, { status: 500 });
  }
};
