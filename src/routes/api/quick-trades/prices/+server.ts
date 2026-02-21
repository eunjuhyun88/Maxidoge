import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query, withTransaction } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { getPairBase, toPositiveNumber, UUID_RE } from '$lib/server/apiValidation';

interface PriceUpdateItem {
  id: string;
  currentPrice: number;
}

interface TradeForUpdate {
  id: string;
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
}

function calcPnlPercent(dir: 'LONG' | 'SHORT', entry: number, currentPrice: number): number {
  if (entry <= 0) return 0;
  if (dir === 'LONG') return ((currentPrice - entry) / entry) * 100;
  return ((entry - currentPrice) / entry) * 100;
}

async function applyExplicitUpdates(userId: string, updates: PriceUpdateItem[]) {
  return withTransaction(async (client) => {
    let updatedCount = 0;
    for (const item of updates) {
      if (!UUID_RE.test(item.id) || !Number.isFinite(item.currentPrice) || item.currentPrice <= 0) continue;

      const tradeResult = await client.query<TradeForUpdate>(
        `SELECT id, pair, dir, entry FROM quick_trades WHERE id = $1 AND user_id = $2 AND status = 'open' LIMIT 1`,
        [item.id, userId]
      );
      const trade = tradeResult.rows[0];
      if (!trade) continue;

      const pnlPercent = Number(calcPnlPercent(trade.dir, Number(trade.entry), Number(item.currentPrice)).toFixed(4));
      await client.query(
        `UPDATE quick_trades SET current_price = $1, pnl_percent = $2 WHERE id = $3 AND user_id = $4`,
        [item.currentPrice, pnlPercent, trade.id, userId]
      );
      updatedCount += 1;
    }

    return updatedCount;
  });
}

async function applyTickerMap(userId: string, prices: Record<string, number>) {
  const openRows = await query<TradeForUpdate>(
    `SELECT id, pair, dir, entry FROM quick_trades WHERE user_id = $1 AND status = 'open'`,
    [userId]
  );

  const updates: PriceUpdateItem[] = [];
  for (const row of openRows.rows) {
    const base = getPairBase(row.pair).toUpperCase();
    const mapped = prices[base];
    if (!Number.isFinite(mapped) || mapped <= 0) continue;
    updates.push({ id: row.id, currentPrice: mapped });
  }

  return applyExplicitUpdates(userId, updates);
}

async function handle(cookies: any, request: Request) {
  const user = await getAuthUserFromCookies(cookies);
  if (!user) return json({ error: 'Authentication required' }, { status: 401 });

  const body = await request.json();
  const updatesRaw = Array.isArray(body?.updates) ? body.updates : null;
  const pricesRaw = body?.prices && typeof body.prices === 'object' ? body.prices : null;

  if (updatesRaw) {
    const updates: PriceUpdateItem[] = updatesRaw.map((x: any) => ({
      id: typeof x?.id === 'string' ? x.id : '',
      currentPrice: toPositiveNumber(x?.currentPrice, 0),
    }));
    const updated = await applyExplicitUpdates(user.id, updates);
    return json({ success: true, updated });
  }

  if (pricesRaw) {
    const normalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(pricesRaw)) {
      const n = toPositiveNumber(v, 0);
      if (n > 0) normalized[String(k).toUpperCase()] = n;
    }

    const updated = await applyTickerMap(user.id, normalized);
    return json({ success: true, updated });
  }

  return json({ error: 'Either updates[] or prices{} is required' }, { status: 400 });
}

export const PATCH: RequestHandler = async ({ cookies, request }) => {
  try {
    return await handle(cookies, request);
  } catch (error: any) {
    if (typeof error?.message === 'string' && error.message.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[quick-trades/prices] unexpected error:', error);
    return json({ error: 'Failed to update trade prices' }, { status: 500 });
  }
};

export const POST = PATCH;
