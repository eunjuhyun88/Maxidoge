// Stockclaw — Social Feed API
// GET /api/social/feed — Arena signals from followed users

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getFollowedSignals } from '$lib/server/arenaSignalBridge';
import { toBoundedInt } from '$lib/server/apiValidation';

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const limit = toBoundedInt(url.searchParams.get('limit'), 20, 1, 50);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 5000);
    const pair = url.searchParams.get('pair') || undefined;

    const result = await getFollowedSignals({
      userId: user.id,
      limit,
      offset,
      pair,
    });

    return json({
      success: true,
      ...result,
      pagination: { limit, offset },
    });
  } catch (err: any) {
    console.error('[social/feed/get]', err);
    return json({ error: 'Failed to fetch feed' }, { status: 500 });
  }
};
