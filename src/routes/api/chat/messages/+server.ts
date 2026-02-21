import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toBoundedInt } from '$lib/server/apiValidation';

const SENDER_KINDS = new Set(['user', 'agent', 'system']);

function mapRow(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    senderKind: row.sender_kind,
    senderId: row.sender_id,
    senderName: row.sender_name,
    message: row.message,
    meta: row.meta ?? {},
    createdAt: new Date(row.created_at).getTime(),
  };
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const limit = toBoundedInt(url.searchParams.get('limit'), 50, 1, 200);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 5000);
    const channel = typeof url.searchParams.get('channel') === 'string' ? url.searchParams.get('channel')!.trim() : '';

    const where = channel ? 'AND channel = $2' : '';
    const params = channel ? [user.id, channel] : [user.id];

    const count = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM agent_chat_messages WHERE user_id = $1 ${where}`,
      params
    );

    const rows = await query(
      `
        SELECT
          id, user_id, channel, sender_kind, sender_id,
          sender_name, message, meta, created_at
        FROM agent_chat_messages
        WHERE user_id = $1
        ${where}
        ORDER BY created_at DESC
        LIMIT $${channel ? 3 : 2} OFFSET $${channel ? 4 : 3}
      `,
      channel ? [user.id, channel, limit, offset] : [user.id, limit, offset]
    );

    return json({
      success: true,
      total: Number(count.rows[0]?.total ?? '0'),
      records: rows.rows.map(mapRow).reverse(),
      pagination: { limit, offset },
    });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[chat/messages/get] unexpected error:', error);
    return json({ error: 'Failed to load chat messages' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();

    const channel = typeof body?.channel === 'string' ? body.channel.trim() : 'terminal';
    const senderKind = typeof body?.senderKind === 'string' ? body.senderKind.trim().toLowerCase() : 'user';
    const senderId = typeof body?.senderId === 'string' ? body.senderId.trim() : null;
    const senderName = typeof body?.senderName === 'string' ? body.senderName.trim() : 'YOU';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const meta = body?.meta && typeof body.meta === 'object' ? body.meta : {};

    if (!message) return json({ error: 'message is required' }, { status: 400 });
    if (!SENDER_KINDS.has(senderKind)) return json({ error: 'senderKind must be user|agent|system' }, { status: 400 });

    const insert = await query(
      `
        INSERT INTO agent_chat_messages (
          user_id, channel, sender_kind, sender_id, sender_name, message, meta, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
        RETURNING
          id, user_id, channel, sender_kind, sender_id, sender_name, message, meta, created_at
      `,
      [user.id, channel, senderKind, senderId, senderName, message, JSON.stringify(meta)]
    );

    await query(
      `
        INSERT INTO activity_events (user_id, event_type, source_page, source_id, severity, payload)
        VALUES ($1, 'chat_sent', 'terminal', $2, 'info', $3::jsonb)
      `,
      [user.id, insert.rows[0].id, JSON.stringify({ channel, senderKind })]
    ).catch(() => undefined);

    return json({ success: true, message: mapRow(insert.rows[0]) });
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[chat/messages/post] unexpected error:', error);
    return json({ error: 'Failed to create chat message' }, { status: 500 });
  }
};
