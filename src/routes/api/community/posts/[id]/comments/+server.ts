// ═══════════════════════════════════════════════════════════════
// GET/POST /api/community/posts/[id]/comments — Comments CRUD
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query, withTransaction } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { UUID_RE, toBoundedInt } from '$lib/server/apiValidation';
import { readJsonBody, isRequestBodyTooLargeError } from '$lib/server/requestGuards';
import { errorContains } from '$lib/utils/errorUtils';
import { type CommentRow, mapCommentRow } from '$lib/server/communityMapping';

/** GET: List comments for a post (paginated, ASC order) */
export const GET: RequestHandler = async ({ params, url, cookies }) => {
  try {
    const postId = params.id;
    if (!postId || !UUID_RE.test(postId)) {
      return json({ error: 'Invalid post id' }, { status: 400 });
    }

    const limit = toBoundedInt(url.searchParams.get('limit'), 50, 1, 100);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 10000);

    const user = await getAuthUserFromCookies(cookies).catch(() => null);
    const currentUserId = user?.id ?? null;

    // Count
    const countResult = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM community_post_comments WHERE post_id = $1`,
      [postId]
    );
    const total = Number(countResult.rows[0]?.total ?? '0');

    // Rows
    const rows = await query<CommentRow>(
      `
        SELECT id, post_id, user_id, author, avatar, avatar_color, tier, body, created_at
        FROM community_post_comments
        WHERE post_id = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
      `,
      [postId, limit, offset]
    );

    return json({
      success: true,
      comments: rows.rows.map((row: CommentRow) => mapCommentRow(row, currentUserId)),
      total,
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[community/posts/[id]/comments/get] unexpected error:', error);
    return json({ error: 'Failed to load comments' }, { status: 500 });
  }
};

/** POST: Create a comment (auth required) */
export const POST: RequestHandler = async ({ params, cookies, request }) => {
  try {
    const postId = params.id;
    if (!postId || !UUID_RE.test(postId)) {
      return json({ error: 'Invalid post id' }, { status: 400 });
    }

    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const reqBody = await readJsonBody<Record<string, unknown>>(request, 8 * 1024);
    const body = typeof reqBody?.body === 'string' ? reqBody.body.trim() : '';

    if (!body || body.length < 1) {
      return json({ error: 'Comment body is required' }, { status: 400 });
    }
    if (body.length > 1000) {
      return json({ error: 'Comment must be 1000 characters or fewer' }, { status: 400 });
    }

    // Verify post exists
    const postExists = await query<{ id: string }>(
      `SELECT id FROM community_posts WHERE id = $1 LIMIT 1`,
      [postId]
    );
    if (!postExists.rowCount) {
      return json({ error: 'Post not found' }, { status: 404 });
    }

    // Insert comment + increment comment_count in a transaction
    const result = await withTransaction(async (client) => {
      const inserted = await client.query<CommentRow>(
        `
          INSERT INTO community_post_comments (post_id, user_id, author, avatar, avatar_color, tier, body)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, post_id, user_id, author, avatar, avatar_color, tier, body, created_at
        `,
        [postId, user.id, user.nickname, '🐕', '#E8967D', user.tier ?? 'guest', body]
      );

      const updated = await client.query<{ comment_count: string }>(
        `
          UPDATE community_posts
          SET comment_count = comment_count + 1
          WHERE id = $1
          RETURNING comment_count::text
        `,
        [postId]
      );

      return {
        comment: inserted.rows[0],
        commentCount: Number(updated.rows[0]?.comment_count ?? '0'),
      };
    });

    return json({
      success: true,
      comment: mapCommentRow(result.comment, user.id),
      commentCount: result.commentCount,
    });
  } catch (error: unknown) {
    if (isRequestBodyTooLargeError(error)) {
      return json({ error: 'Request body too large' }, { status: 413 });
    }
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }
    console.error('[community/posts/[id]/comments/post] unexpected error:', error);
    return json({ error: 'Failed to create comment' }, { status: 500 });
  }
};
