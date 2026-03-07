import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toBoundedInt } from '$lib/server/apiValidation';
import { mapCopyTradeRunRow, type CopyTradeRunRow } from '$lib/server/copyTradeRunMapper';
import { errorContains } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const limit = toBoundedInt(url.searchParams.get('limit'), 50, 1, 200);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 5000);

    const total = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM copy_trade_runs WHERE user_id = $1`,
      [user.id]
    );

    const rows = await query<CopyTradeRunRow>(
      `
        SELECT
          id, user_id, selected_signal_ids, draft, published,
          published_trade_id, published_signal_id, created_at, published_at
        FROM copy_trade_runs
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [user.id, limit, offset]
    );

    return json({
      success: true,
      total: Number(total.rows[0]?.total ?? '0'),
      records: rows.rows.map(mapCopyTradeRunRow),
      pagination: { limit, offset },
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[copy-trades/runs/get] unexpected error:', error);
    return json({ error: 'Failed to load copy trade runs' }, { status: 500 });
  }
};
