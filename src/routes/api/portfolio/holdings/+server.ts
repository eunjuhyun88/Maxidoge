import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { PortfolioHolding } from '$lib/contracts/positions';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';

interface HoldingRow {
  id: string;
  asset_symbol: string;
  asset_name: string;
  amount: string | number;
  avg_price: string | number;
  current_price: string | number;
  source: string;
  created_at: string;
  updated_at: string;
}

function mapHoldingRow(row: HoldingRow): PortfolioHolding {
  return {
    id: row.id,
    symbol: row.asset_symbol,
    name: row.asset_name,
    amount: Number(row.amount),
    avgPrice: Number(row.avg_price),
    currentPrice: Number(row.current_price),
    source: row.source,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── GET: 유저 포트폴리오 holdings 조회 ────────────────────
export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const result = await query<HoldingRow>(
      `SELECT id, asset_symbol, asset_name, amount, avg_price, current_price, source,
              created_at, updated_at
       FROM portfolio_holdings
       WHERE user_id = $1
       ORDER BY (amount * current_price) DESC`,
      [user.id]
    );
    const holdings = result.rows.map(mapHoldingRow);

    // Compute totals server-side
    const totalValue = holdings.reduce(
      (sum: number, holding: PortfolioHolding) => sum + holding.amount * holding.currentPrice,
      0,
    );
    const totalCost = holdings.reduce(
      (sum: number, holding: PortfolioHolding) => sum + holding.amount * holding.avgPrice,
      0,
    );

    return json({
      ok: true,
      data: { holdings, totalValue, totalCost },
    });
  } catch (error: unknown) {
    console.error('[portfolio/holdings/get]', error);
    return json({ error: 'Failed to load holdings' }, { status: 500 });
  }
};

// ─── POST: holding 추가/업데이트 (UPSERT) ──────────────────
export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const symbol = (body?.symbol ?? '').toString().toUpperCase().trim();
    const name = (body?.name ?? symbol).toString().trim();
    const amount = Number(body?.amount ?? 0);
    const avgPrice = Number(body?.avgPrice ?? 0);
    const currentPrice = Number(body?.currentPrice ?? avgPrice);
    const source = (body?.source ?? 'manual').toString().trim();

    if (!symbol || symbol.length > 12) {
      return json({ error: 'Invalid symbol' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return json({ error: 'Invalid amount' }, { status: 400 });
    }

    const result = await query<HoldingRow>(
      `INSERT INTO portfolio_holdings (user_id, asset_symbol, asset_name, amount, avg_price, current_price, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, asset_symbol, source)
       DO UPDATE SET
         asset_name = EXCLUDED.asset_name,
         amount = EXCLUDED.amount,
         avg_price = EXCLUDED.avg_price,
         current_price = EXCLUDED.current_price,
         updated_at = now()
       RETURNING id, asset_symbol, asset_name, amount, avg_price, current_price, source, updated_at`,
      [user.id, symbol, name, amount, avgPrice, currentPrice, source]
    );

    const holding = result.rows[0] ? mapHoldingRow(result.rows[0]) : null;
    return json({
      ok: true,
      holding,
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, { status: 400 });
    console.error('[portfolio/holdings/post]', error);
    return json({ error: 'Failed to save holding' }, { status: 500 });
  }
};
