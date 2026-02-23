// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Unified Positions API
// ═══════════════════════════════════════════════════════════════
// Returns QuickTrades + Polymarket positions in unified format.
//
// GET /api/positions/unified?type=all|quick_trade|polymarket&limit=50

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { query } from '$lib/server/db';

interface UnifiedPosition {
  id: string;
  type: 'quick_trade' | 'polymarket';
  asset: string;
  direction: string;
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  pnlUsdc: number | null;
  amountUsdc: number | null;
  status: string;
  openedAt: number;
  meta: Record<string, unknown>;
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const typeFilter = url.searchParams.get('type') ?? 'all';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
    const positions: UnifiedPosition[] = [];

    // Fetch QuickTrades
    if (typeFilter === 'all' || typeFilter === 'quick_trade') {
      const qtResult = await query(
        `SELECT * FROM quick_trades
         WHERE user_id = $1 AND status = 'open'
         ORDER BY opened_at DESC
         LIMIT $2`,
        [user.id, limit],
      );

      for (const row of qtResult.rows) {
        const entry = Number(row.entry_price ?? row.entry ?? 0);
        const current = Number(row.current_price ?? entry);
        const pnlPct = entry > 0 ? ((current - entry) / entry) * 100 * (row.direction === 'SHORT' ? -1 : 1) : 0;

        positions.push({
          id: row.id,
          type: 'quick_trade',
          asset: row.pair ?? '',
          direction: row.direction ?? 'LONG',
          entryPrice: entry,
          currentPrice: current,
          pnlPercent: Math.round(pnlPct * 100) / 100,
          pnlUsdc: null,
          amountUsdc: null,
          status: row.status ?? 'open',
          openedAt: new Date(row.opened_at ?? row.created_at).getTime(),
          meta: {
            tp: row.take_profit ?? row.tp,
            sl: row.stop_loss ?? row.sl,
            source: row.source ?? 'manual',
          },
        });
      }
    }

    // Fetch Polymarket positions
    if (typeFilter === 'all' || typeFilter === 'polymarket') {
      const polyResult = await query(
        `SELECT * FROM polymarket_positions
         WHERE user_id = $1 AND settled = false
         ORDER BY created_at DESC
         LIMIT $2`,
        [user.id, limit],
      );

      for (const row of polyResult.rows) {
        const entry = Number(row.price);
        const current = row.current_price ? Number(row.current_price) : entry;
        const size = Number(row.size);
        const pnlUsdc = (current - entry) * size;
        const pnlPct = entry > 0 ? ((current - entry) / entry) * 100 : 0;

        positions.push({
          id: row.id,
          type: 'polymarket',
          asset: row.market_title || row.market_id,
          direction: row.direction,
          entryPrice: entry,
          currentPrice: current,
          pnlPercent: Math.round(pnlPct * 100) / 100,
          pnlUsdc: Math.round(pnlUsdc * 100) / 100,
          amountUsdc: Number(row.amount_usdc),
          status: row.order_status,
          openedAt: new Date(row.created_at).getTime(),
          meta: {
            marketSlug: row.market_slug,
            tokenId: row.token_id,
            clobOrderId: row.clob_order_id,
            filledSize: Number(row.filled_size),
            walletAddress: row.wallet_address,
          },
        });
      }
    }

    // Sort by openedAt DESC
    positions.sort((a, b) => b.openedAt - a.openedAt);

    return json({
      ok: true,
      positions: positions.slice(0, limit),
      total: positions.length,
    });
  } catch (error: any) {
    console.error('[positions/unified] error:', error);
    return json({ error: 'Failed to fetch positions' }, { status: 500 });
  }
};
