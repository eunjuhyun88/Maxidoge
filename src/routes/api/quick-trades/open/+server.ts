import { json } from '@sveltejs/kit';
import { fireAndForget } from '$lib/server/taskUtils';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import { normalizePair, normalizeTradeDir, PAIR_RE, toPositiveNumber } from '$lib/server/apiValidation';
import { runIpRateLimitGuard } from '$lib/server/authSecurity';
import { enqueuePassportEventBestEffort } from '$lib/server/passportOutbox';
import { quickTradeMutationLimiter } from '$lib/server/rateLimit';
import { saveQuickTradeOpenRAG } from '$lib/server/ragService';
import { readJsonBodySafely } from '$lib/server/requestGuards';
import { getErrorMessage } from '$lib/utils/errorUtils';

const QUICK_TRADE_MUTATION_MAX_BYTES = 16 * 1024;

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

export const POST: RequestHandler = async ({ cookies, request, getClientAddress }) => {
  const guard = await runIpRateLimitGuard({
    request,
    fallbackIp: getClientAddress(),
    limiter: quickTradeMutationLimiter,
    scope: 'quick-trades:open',
    max: 30,
    tooManyMessage: 'Too many quick trade requests.',
  });
  if (!guard.ok) return guard.response;

  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });

    const bodyResult = await readJsonBodySafely<Record<string, unknown>>(request, QUICK_TRADE_MUTATION_MAX_BYTES);
    if (!bodyResult.ok) return bodyResult.response;

    const body = bodyResult.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid request body' }, { status: 400 });
    }

    const pair = normalizePair(body?.pair);
    const dir = normalizeTradeDir(body?.dir);
    const entry = toPositiveNumber(body?.entry, 0);
    const tp = body?.tp == null ? null : toPositiveNumber(body.tp, 0);
    const sl = body?.sl == null ? null : toPositiveNumber(body.sl, 0);
    const currentPrice = toPositiveNumber(body?.currentPrice, entry);
    const source = typeof body?.source === 'string' ? body.source.trim().toLowerCase() : 'manual';
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!PAIR_RE.test(pair)) return json({ error: 'Invalid pair format' }, { status: 400 });
    if (!dir) return json({ error: 'dir must be LONG or SHORT' }, { status: 400 });
    if (entry <= 0) return json({ error: 'entry must be greater than 0' }, { status: 400 });
    if (source.length > 64) return json({ error: 'source must be 64 chars or fewer' }, { status: 400 });
    if (note.length > 2000) return json({ error: 'note must be 2000 chars or fewer' }, { status: 400 });

    // TP/SL logical bounds validation
    if (tp != null && tp <= 0) return json({ error: 'tp must be greater than 0' }, { status: 400 });
    if (sl != null && sl <= 0) return json({ error: 'sl must be greater than 0' }, { status: 400 });
    if (dir === 'LONG') {
      if (tp != null && tp <= entry) return json({ error: 'LONG tp must be above entry price' }, { status: 400 });
      if (sl != null && sl >= entry) return json({ error: 'LONG sl must be below entry price' }, { status: 400 });
    } else {
      if (tp != null && tp >= entry) return json({ error: 'SHORT tp must be below entry price' }, { status: 400 });
      if (sl != null && sl <= entry) return json({ error: 'SHORT sl must be above entry price' }, { status: 400 });
    }

    const result = await query<QuickTradeRow>(
      `
        INSERT INTO quick_trades (
          user_id, pair, dir, entry, tp, sl, current_price,
          pnl_percent, status, source, note, opened_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'open', $8, $9, now())
        RETURNING
          id, user_id, pair, dir, entry, tp, sl, current_price, pnl_percent,
          status, source, note, opened_at, closed_at, close_pnl
      `,
      [user.id, pair, dir, entry, tp, sl, currentPrice, source, note]
    );

    const trade = mapTrade(result.rows[0]);

    await enqueuePassportEventBestEffort({
      userId: user.id,
      eventType: 'quick_trade_opened',
      sourceTable: 'quick_trades',
      sourceId: trade.id,
      traceId: `quick-trade:${trade.id}`,
      idempotencyKey: `quick_trade_opened:${trade.id}`,
      payload: {
        context: {
          pair: trade.pair,
          source: trade.source,
        },
        decision: {
          dir: trade.dir,
          entry: trade.entry,
          tp: trade.tp,
          sl: trade.sl,
        },
      },
    });

    // Decision Memory: QuickTrade Open → RAG (fire-and-forget)
    // chainId: scan 기반이면 scan-{note}, 아니면 trade-{id}
    const chainId = trade.source === 'terminal_scan' && trade.note
      ? `scan-${trade.note}` : `trade-${trade.id}`;
    fireAndForget('trade-open-rag', saveQuickTradeOpenRAG(user.id, {
      tradeId: trade.id,
      pair: trade.pair,
      dir: trade.dir,
      entry: trade.entry,
      currentPrice: trade.currentPrice,
      tp: trade.tp,
      sl: trade.sl,
      source: trade.source,
      note: trade.note,
    }, chainId));

    return json({ success: true, trade });
  } catch (error: unknown) {
    const msg = error instanceof Error ? getErrorMessage(error) : '';
    if (msg.includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[quick-trades/open] unexpected error:', error);
    return json({ error: 'Failed to open trade' }, { status: 500 });
  }
};
