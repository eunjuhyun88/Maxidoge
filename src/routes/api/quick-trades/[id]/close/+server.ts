import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toPositiveNumber, UUID_RE } from '$lib/server/apiValidation';
import { errorContains } from '$lib/utils/errorUtils';

interface QuickTradeRow {
  id: string;
  user_id: string;
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number | null;
  sl: number | null;
  current_price: number;
  pnl_percent: number;
  status: 'open' | 'closed' | 'stopped';
  source: string | null;
  note: string | null;
  opened_at: string;
  closed_at: string | null;
  close_pnl: number | null;
}

function calcPnlPercent(dir: 'LONG' | 'SHORT', entry: number, closePrice: number): number {
  if (entry <= 0) return 0;
  if (dir === 'LONG') return ((closePrice - entry) / entry) * 100;
  return ((entry - closePrice) / entry) * 100;
}

function mapTrade(row: QuickTradeRow) {
  return {
    id: row.id,
    userId: row.user_id,
    pair: row.pair,
    dir: row.dir,
    entry: Number(row.entry),
    tp: row.tp == null ? null : Number(row.tp),
    sl: row.sl == null ? null : Number(row.sl),
    currentPrice: Number(row.current_price),
    pnlPercent: Number(row.pnl_percent ?? 0),
    status: row.status,
    source: row.source || 'manual',
    note: row.note || '',
    openedAt: new Date(row.opened_at).getTime(),
    closedAt: row.closed_at ? new Date(row.closed_at).getTime() : null,
    closePnl: row.close_pnl == null ? null : Number(row.close_pnl),
  };
}

export const POST: RequestHandler = async ({ cookies, request, params }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const id = params.id;
    if (!id || !UUID_RE.test(id)) return json({ error: 'Invalid trade id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));

    const found = await query<QuickTradeRow>(
      `
        SELECT
          id, user_id, pair, dir, entry, tp, sl, current_price, pnl_percent,
          status, source, note, opened_at, closed_at, close_pnl
        FROM quick_trades
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [id, user.id]
    );

    const row = found.rows[0];
    if (!row) return json({ error: 'Trade not found' }, { status: 404 });
    if (row.status !== 'open') return json({ error: 'Only open trades can be closed' }, { status: 409 });

    const closePrice = toPositiveNumber(body?.closePrice, Number(row.current_price));
    const pnlPercent = Number(calcPnlPercent(row.dir, Number(row.entry), closePrice).toFixed(4));
    const closePnl = body?.closePnl == null ? pnlPercent : Number(body.closePnl);
    const nextStatus = body?.status === 'stopped' ? 'stopped' : 'closed';

    const updated = await query<QuickTradeRow>(
      `
        UPDATE quick_trades
        SET
          current_price = $1,
          pnl_percent = $2,
          close_pnl = $3,
          status = $4,
          closed_at = now()
        WHERE id = $5 AND user_id = $6
        RETURNING
          id, user_id, pair, dir, entry, tp, sl, current_price, pnl_percent,
          status, source, note, opened_at, closed_at, close_pnl
      `,
      [closePrice, pnlPercent, closePnl, nextStatus, id, user.id]
    );

    return json({ success: true, trade: mapTrade(updated.rows[0]) });
  } catch (error: unknown) {
    if (errorContains(error, 'DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[quick-trades/close] unexpected error:', error);
    return json({ error: 'Failed to close trade' }, { status: 500 });
  }
};
