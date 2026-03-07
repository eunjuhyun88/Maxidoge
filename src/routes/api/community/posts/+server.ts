import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toBoundedInt } from '$lib/server/apiValidation';
import { isRequestBodyTooLargeError, readJsonBody } from '$lib/server/requestGuards';
import { errorContains } from '$lib/utils/errorUtils';

interface PostRow {
  id: string;
  user_id: string | null;
  author: string;
  avatar: string;
  avatar_color: string;
  body: string;
  signal: 'long' | 'short' | null;
  likes: number;
  created_at: string;
  signal_attachment: Record<string, unknown> | null;
  comment_count: number;
  copy_count: number;
  allow_copy_trade: boolean;
  user_reacted: boolean;
}

function mapRow(row: PostRow) {
  const att = row.signal_attachment;
  return {
    id: row.id,
    userId: row.user_id,
    author: row.author,
    avatar: row.avatar,
    avatarColor: row.avatar_color,
    body: row.body,
    signal: row.signal,
    likes: Number(row.likes ?? 0),
    createdAt: new Date(row.created_at).getTime(),
    signalAttachment: att ? {
      pair: String(att.pair ?? ''),
      dir: String(att.dir ?? 'LONG') as 'LONG' | 'SHORT',
      entry: Number(att.entry ?? 0),
      tp: Number(att.tp ?? 0),
      sl: Number(att.sl ?? 0),
      conf: Number(att.conf ?? 50),
      timeframe: att.timeframe ? String(att.timeframe) : undefined,
      reason: att.reason ? String(att.reason) : undefined,
    } : null,
    userReacted: Boolean(row.user_reacted),
    commentCount: Number(row.comment_count ?? 0),
    copyCount: Number(row.copy_count ?? 0),
    allowCopyTrade: Boolean(row.allow_copy_trade),
  };
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const limit = toBoundedInt(url.searchParams.get('limit'), 50, 1, 100);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 1000);
    const signal = (url.searchParams.get('signal') || '').trim().toLowerCase();

    // Get current user for userReacted flag (nullable)
    const user = await getAuthUserFromCookies(cookies).catch(() => null);
    const userId = user?.id ?? null;

    const hasSignalFilter = signal === 'long' || signal === 'short';

    // Count query
    const countSql = hasSignalFilter
      ? `SELECT count(*)::text AS total FROM community_posts WHERE signal = $1`
      : `SELECT count(*)::text AS total FROM community_posts`;
    const countParams = hasSignalFilter ? [signal] : [];
    const total = await query<{ total: string }>(countSql, countParams);

    // Main query with LEFT JOIN for userReacted
    let paramIdx = 1;
    const params: unknown[] = [];

    // $1 = userId (for LEFT JOIN)
    params.push(userId);
    paramIdx++;

    let whereClauses = '';
    if (hasSignalFilter) {
      whereClauses = `WHERE p.signal = $${paramIdx}`;
      params.push(signal);
      paramIdx++;
    }

    params.push(limit);
    const limitIdx = paramIdx++;
    params.push(offset);
    const offsetIdx = paramIdx;

    const rows = await query<PostRow>(
      `
        SELECT
          p.id, p.user_id, p.author, p.avatar, p.avatar_color, p.body,
          p.signal, p.likes, p.created_at,
          p.signal_attachment, p.comment_count, p.copy_count, p.allow_copy_trade,
          CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS user_reacted
        FROM community_posts p
        LEFT JOIN community_post_reactions r
          ON r.post_id = p.id AND r.user_id = $1 AND r.emoji = '👍'
        ${whereClauses}
        ORDER BY p.created_at DESC
        LIMIT $${limitIdx}
        OFFSET $${offsetIdx}
      `,
      params
    );

    return json({
      success: true,
      total: Number(total.rows[0]?.total ?? '0'),
      records: rows.rows.map(mapRow),
      pagination: { limit, offset },
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[community/posts/get] unexpected error:', error);
    return json({ error: 'Failed to load community posts' }, { status: 500 });
  }
};

interface SignalAttachmentInput {
  pair?: string;
  dir?: string;
  entry?: number;
  tp?: number;
  sl?: number;
  conf?: number;
  timeframe?: string;
  reason?: string;
}

function validateSignalAttachment(input: unknown): SignalAttachmentInput | null {
  if (!input || typeof input !== 'object') return null;
  const att = input as Record<string, unknown>;

  const pair = typeof att.pair === 'string' ? att.pair.trim() : '';
  const dir = typeof att.dir === 'string' ? att.dir.trim().toUpperCase() : '';
  const entry = Number(att.entry);
  const tp = Number(att.tp);
  const sl = Number(att.sl);
  const conf = Number(att.conf);

  if (!pair || pair.length > 32) return null;
  if (dir !== 'LONG' && dir !== 'SHORT') return null;
  if (!isFinite(entry) || entry <= 0) return null;
  if (!isFinite(tp) || tp <= 0) return null;
  if (!isFinite(sl) || sl <= 0) return null;
  if (!isFinite(conf) || conf < 1 || conf > 100) return null;

  const result: SignalAttachmentInput = { pair, dir, entry, tp, sl, conf };
  if (typeof att.timeframe === 'string' && att.timeframe.trim()) {
    result.timeframe = att.timeframe.trim().slice(0, 8);
  }
  if (typeof att.reason === 'string' && att.reason.trim()) {
    result.reason = att.reason.trim().slice(0, 500);
  }
  return result;
}

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await readJsonBody<Record<string, unknown>>(request, 16 * 1024);

    const author = user.nickname;
    const avatar = typeof body?.avatar === 'string' ? body.avatar.trim() : '🐕';
    const avatarColor = typeof body?.avatarColor === 'string' ? body.avatarColor.trim() : '#E8967D';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    const signal = typeof body?.signal === 'string' ? body.signal.trim().toLowerCase() : null;
    const signalAttachment = validateSignalAttachment(body?.signalAttachment);
    const allowCopyTrade = Boolean(body?.allowCopyTrade);

    if (!content || content.length < 2) {
      return json({ error: 'body must be at least 2 chars' }, { status: 400 });
    }
    if (content.length > 2000) {
      return json({ error: 'body must be 2000 chars or fewer' }, { status: 400 });
    }
    if (avatar.length > 32) {
      return json({ error: 'avatar must be 32 chars or fewer' }, { status: 400 });
    }
    if (avatarColor.length > 32) {
      return json({ error: 'avatarColor must be 32 chars or fewer' }, { status: 400 });
    }
    if (signal && signal !== 'long' && signal !== 'short') {
      return json({ error: 'signal must be long|short or null' }, { status: 400 });
    }

    const insert = await query<PostRow>(
      `
        INSERT INTO community_posts (
          user_id, author, avatar, avatar_color, body, signal,
          likes, signal_attachment, allow_copy_trade, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 0, $7::jsonb, $8, now())
        RETURNING id, user_id, author, avatar, avatar_color, body, signal,
          likes, created_at, signal_attachment, comment_count, copy_count, allow_copy_trade,
          false AS user_reacted
      `,
      [
        user.id, author, avatar, avatarColor, content, signal,
        signalAttachment ? JSON.stringify(signalAttachment) : null,
        allowCopyTrade,
      ]
    );

    await query(
      `
        INSERT INTO activity_events (user_id, event_type, source_page, source_id, severity, payload)
        VALUES ($1, 'community_posted', 'terminal', $2, 'info', $3::jsonb)
      `,
      [user.id, insert.rows[0].id, JSON.stringify({ signal, hasAttachment: !!signalAttachment })]
    ).catch(() => undefined);

    return json({ success: true, post: mapRow(insert.rows[0]) });
  } catch (error: unknown) {
    if (isRequestBodyTooLargeError(error)) {
      return json({ error: 'Request body too large' }, { status: 413 });
    }
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[community/posts/post] unexpected error:', error);
    return json({ error: 'Failed to create community post' }, { status: 500 });
  }
};
