import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { UUID_RE } from '$lib/server/apiValidation';
import { mapCopyTradeRunRow, type CopyTradeRunRow } from '$lib/server/copyTradeRunMapper';
import { errorContains } from '$lib/utils/errorUtils';

export const GET: RequestHandler = async ({ cookies, params }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const id = params.id;
    if (!id || !UUID_RE.test(id)) return json({ error: 'Invalid run id' }, { status: 400 });

    const result = await query<CopyTradeRunRow>(
      `
        SELECT
          id, user_id, selected_signal_ids, draft, published,
          published_trade_id, published_signal_id, created_at, published_at
        FROM copy_trade_runs
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [id, user.id]
    );

    if (!result.rowCount) return json({ error: 'Copy-trade run not found' }, { status: 404 });
    return json({ success: true, run: mapCopyTradeRunRow(result.rows[0]) });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[copy-trades/runs/id/get] unexpected error:', error);
    return json({ error: 'Failed to load copy-trade run detail' }, { status: 500 });
  }
};
