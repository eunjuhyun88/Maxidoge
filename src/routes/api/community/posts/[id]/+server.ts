// ═══════════════════════════════════════════════════════════════
// GET /api/community/posts/[id] — Signal detail (single post)
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { UUID_RE } from '$lib/server/apiValidation';
import { errorContains } from '$lib/utils/errorUtils';
import { type PostRow, mapPostRow, POST_SELECT_COLUMNS } from '$lib/server/communityMapping';

export const GET: RequestHandler = async ({ params, cookies }) => {
  try {
    const id = params.id;
    if (!id || !UUID_RE.test(id)) {
      return json({ error: 'Invalid post id' }, { status: 400 });
    }

    // Get current user for userReacted flag (nullable)
    const user = await getAuthUserFromCookies(cookies).catch(() => null);
    const userId = user?.id ?? null;

    const result = await query<PostRow>(
      `
        SELECT
          ${POST_SELECT_COLUMNS},
          CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS user_reacted
        FROM community_posts p
        LEFT JOIN community_post_reactions r
          ON r.post_id = p.id AND r.user_id = $1 AND r.emoji = '👍'
        WHERE p.id = $2
        LIMIT 1
      `,
      [userId, id]
    );

    if (!result.rowCount) {
      return json({ error: 'Post not found' }, { status: 404 });
    }

    return json({ success: true, post: mapPostRow(result.rows[0]) });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[community/posts/[id]/get] unexpected error:', error);
    return json({ error: 'Failed to load post' }, { status: 500 });
  }
};
