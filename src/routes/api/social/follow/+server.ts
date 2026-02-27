// Stockclaw — Social Follow API
// POST /api/social/follow — Follow a user
// DELETE /api/social/follow — Unfollow a user

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { query } from '$lib/server/db';
import { socialFollowLimiter } from '$lib/server/rateLimit';

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

export const POST: RequestHandler = async ({ cookies, request, getClientAddress }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const ip = getClientAddress();
    if (!socialFollowLimiter.check(ip)) {
      return json({ error: 'Too many follow requests' }, { status: 429 });
    }

    const body = await request.json();
    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!targetUserId) return json({ error: 'userId is required' }, { status: 400 });
    if (targetUserId === user.id) return json({ error: 'Cannot follow yourself' }, { status: 400 });

    try {
      await query(
        `INSERT INTO user_follows (follower_id, following_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_id, following_id) DO NOTHING`,
        [user.id, targetUserId],
      );
    } catch (err: unknown) {
      if (!isTableError(err)) throw err;
    }

    return json({ success: true, following: true, targetUserId });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[social/follow/post]', err);
    return json({ error: 'Failed to follow user' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!targetUserId) return json({ error: 'userId is required' }, { status: 400 });

    try {
      await query(
        `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
        [user.id, targetUserId],
      );
    } catch (err: unknown) {
      if (!isTableError(err)) throw err;
    }

    return json({ success: true, following: false, targetUserId });
  } catch (err: any) {
    if (err instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[social/follow/delete]', err);
    return json({ error: 'Failed to unfollow user' }, { status: 500 });
  }
};
