// ═══════════════════════════════════════════════════════════════
// DELETE /api/community/posts/[id]/comments/[commentId]
// ═══════════════════════════════════════════════════════════════

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withTransaction } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { UUID_RE } from '$lib/server/apiValidation';
import { errorContains } from '$lib/utils/errorUtils';

export const DELETE: RequestHandler = async ({ params, cookies }) => {
  try {
    const postId = params.id;
    const commentId = params.commentId;

    if (!postId || !UUID_RE.test(postId)) {
      return json({ error: 'Invalid post id' }, { status: 400 });
    }
    if (!commentId || !UUID_RE.test(commentId)) {
      return json({ error: 'Invalid comment id' }, { status: 400 });
    }

    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    // Delete own comment + decrement comment_count in a transaction
    const result = await withTransaction(async (client) => {
      const deleted = await client.query(
        `
          DELETE FROM community_post_comments
          WHERE id = $1 AND post_id = $2 AND user_id = $3
        `,
        [commentId, postId, user.id]
      );

      if (!deleted.rowCount) {
        return { deleted: false, commentCount: -1 };
      }

      const updated = await client.query<{ comment_count: string }>(
        `
          UPDATE community_posts
          SET comment_count = GREATEST(0, comment_count - 1)
          WHERE id = $1
          RETURNING comment_count::text
        `,
        [postId]
      );

      return {
        deleted: true,
        commentCount: Number(updated.rows[0]?.comment_count ?? '0'),
      };
    });

    if (!result.deleted) {
      return json({ error: 'Comment not found or not yours' }, { status: 404 });
    }

    return json({
      success: true,
      deleted: true,
      commentCount: result.commentCount,
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[community/posts/[id]/comments/[commentId]/delete] unexpected error:', error);
    return json({ error: 'Failed to delete comment' }, { status: 500 });
  }
};
