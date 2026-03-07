import { json } from '@sveltejs/kit';
import { fireAndForget } from '$lib/server/taskUtils';
import type { RequestHandler } from './$types';
import { query, withTransaction } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { toPositiveNumber, UUID_RE } from '$lib/server/apiValidation';
import { runIpRateLimitGuard } from '$lib/server/authSecurity';
import { enqueuePassportEventBestEffort } from '$lib/server/passportOutbox';
import { quickTradeMutationLimiter } from '$lib/server/rateLimit';
import { syncUserProfileProjection } from '$lib/server/profileProjection';
import { saveQuickTradeCloseRAG } from '$lib/server/ragService';
import { mapQuickTradeRow, type QuickTradeRow } from '$lib/server/quickTradeMapper';
import { readJsonBodySafely } from '$lib/server/requestGuards';
import { calcPnlPercent } from '$lib/utils/pnl';

const QUICK_TRADE_MUTATION_MAX_BYTES = 16 * 1024;

export const POST: RequestHandler = async ({ cookies, request, params, getClientAddress }) => {
  const guard = await runIpRateLimitGuard({
    request,
    fallbackIp: getClientAddress(),
    limiter: quickTradeMutationLimiter,
    scope: 'quick-trades:close',
    max: 30,
    tooManyMessage: 'Too many quick trade requests.',
  });
  if (!guard.ok) return guard.response;

  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const id = params.id;
    if (!id || !UUID_RE.test(id)) return json({ error: 'Invalid trade id' }, { status: 400 });

    const bodyResult = await readJsonBodySafely<Record<string, unknown>>(request, QUICK_TRADE_MUTATION_MAX_BYTES);
    if (!bodyResult.ok) return bodyResult.response;

    const body = bodyResult.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (body.closePrice != null && toPositiveNumber(body.closePrice, 0) <= 0) {
      return json({ error: 'closePrice must be greater than 0' }, { status: 400 });
    }
    if (body.closePnl != null && !Number.isFinite(Number(body.closePnl))) {
      return json({ error: 'closePnl must be a finite number' }, { status: 400 });
    }
    if (body.status != null && body.status !== 'closed' && body.status !== 'stopped') {
      return json({ error: 'status must be closed or stopped' }, { status: 400 });
    }

    // Wrap SELECT + UPDATE in transaction to prevent race condition
    // (two concurrent close requests on the same trade)
    const trade = await withTransaction(async (client) => {
      const found = await client.query<QuickTradeRow>(
        `
          SELECT
            id, user_id, pair, dir, entry, tp, sl, current_price, pnl_percent,
            status, source, note, opened_at, closed_at, close_pnl
          FROM quick_trades
          WHERE id = $1 AND user_id = $2
          FOR UPDATE
          LIMIT 1
        `,
        [id, user.id]
      );

      const row = found.rows[0];
      if (!row) throw Object.assign(new Error('Trade not found'), { httpStatus: 404 });
      if (row.status !== 'open') throw Object.assign(new Error('Only open trades can be closed'), { httpStatus: 409 });

      const closePrice = toPositiveNumber(body?.closePrice, Number(row.current_price));
      const pnlPercent = calcPnlPercent(row.dir, Number(row.entry), closePrice, 4);
      const closePnl = body?.closePnl == null ? pnlPercent : Number(body.closePnl);
      const nextStatus = body?.status === 'stopped' ? 'stopped' : 'closed';

      const updated = await client.query<QuickTradeRow>(
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

      return mapQuickTradeRow(updated.rows[0]);
    }).catch((txErr: unknown) => {
      // Re-throw HTTP-status errors for the outer catch to handle
      const e = txErr as Error & { httpStatus?: number };
      if (e.httpStatus) throw e;
      throw txErr;
    });

    await enqueuePassportEventBestEffort({
      userId: user.id,
      eventType: 'quick_trade_closed',
      sourceTable: 'quick_trades',
      sourceId: trade.id,
      traceId: `quick-trade:${trade.id}`,
      idempotencyKey: `quick_trade_closed:${trade.id}:${trade.closedAt ?? Date.now()}`,
      payload: {
        context: {
          pair: trade.pair,
          source: trade.source,
        },
        decision: {
          dir: trade.dir,
          entry: trade.entry,
        },
        outcome: {
          status: trade.status,
          closePrice: trade.currentPrice,
          pnlPercent: trade.pnlPercent,
          closePnl: trade.closePnl,
        },
      },
    });

    // ⭐ Decision Memory: QuickTrade Close → RAG + Chain Maturation (fire-and-forget)
    // chainId 추론: source가 terminal_scan이면 note에서, 아니면 trade-{id}
    const chainId = trade.source === 'terminal_scan' && trade.note
      ? `scan-${trade.note}` : `trade-${trade.id}`;
    fireAndForget('trade-close-rag', saveQuickTradeCloseRAG(user.id, {
      tradeId: trade.id,
      pair: trade.pair,
      dir: trade.dir,
      entry: trade.entry,
      currentPrice: trade.currentPrice,
      tp: trade.tp,
      sl: trade.sl,
      source: trade.source,
      note: trade.note,
      pnlPercent: trade.pnlPercent,
      exitPrice: trade.currentPrice,
    }, chainId));

    fireAndForget('trade-close-profile-sync', syncUserProfileProjection(user.id));

    return json({ success: true, trade });
  } catch (error: unknown) {
    const e = error as Error & { httpStatus?: number };
    const msg = e.message ?? '';
    if (e.httpStatus) {
      return json({ error: msg }, { status: e.httpStatus });
    }
    if (msg.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[quick-trades/close] unexpected error:', error);
    return json({ error: 'Failed to close trade' }, { status: 500 });
  }
};
