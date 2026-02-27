// Stockclaw — LIVE Sessions List API
// GET /api/arena/live/sessions — List active LIVE sessions

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveLiveSessions } from '$lib/server/liveConnectionManager';
import { toBoundedInt } from '$lib/server/apiValidation';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = toBoundedInt(url.searchParams.get('limit'), 20, 1, 50);
    const sessions = await getActiveLiveSessions(limit);

    return json({
      success: true,
      sessions,
      total: sessions.length,
    });
  } catch (err: any) {
    console.error('[arena/live/sessions/get]', err);
    return json({ error: 'Failed to list LIVE sessions' }, { status: 500 });
  }
};
