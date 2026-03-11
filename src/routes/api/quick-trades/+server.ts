import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toBoundedInt } from '$lib/server/apiValidation';
import { mapQuickTradeRow, type QuickTradeRow } from '$lib/server/quickTradeMapper';
import { errorContains } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const limit = toBoundedInt(url.searchParams.get('limit'), 50, 1, 200);
    const offset = toBoundedInt(url.searchParams.get('offset'), 0, 0, 5000);
    const status = (url.searchParams.get('status') || '').trim();

    const statusFilter = status ? 'AND status = $2' : '';
    const countParams = status ? [user.id, status] : [user.id];
    const listParams = status ? [user.id, status, limit, offset] : [user.id, limit, offset];

    const totalResult = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM quick_trades WHERE user_id = $1 ${statusFilter}`,
      countParams
    );

    const rows = await query<QuickTradeRow>(
      `
        SELECT
          id, user_id, pair, dir, entry, tp, sl, current_price, pnl_percent,
          status, source, note, opened_at, closed_at, close_pnl
        FROM quick_trades
        WHERE user_id = $1
        ${statusFilter}
        ORDER BY opened_at DESC
        LIMIT $${status ? 3 : 2}
        OFFSET $${status ? 4 : 3}
      `,
      listParams
    );

    return json({
      success: true,
      total: Number(totalResult.rows[0]?.total ?? '0'),
      records: rows.rows.map((row: QuickTradeRow) => mapQuickTradeRow(row)),
      pagination: { limit, offset },
    });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[quick-trades/get] unexpected error:', error);
    return json({ error: 'Failed to load quick trades' }, { status: 500 });
  }
};
