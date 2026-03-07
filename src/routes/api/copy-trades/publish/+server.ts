import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query, withTransaction } from '$lib/server/db';
import { getAuthUserFromCookies } from '$lib/server/authGuard';
import {
  normalizePair,
  normalizeTradeDir,
  PAIR_RE,
  toBoundedInt,
  toPositiveNumber,
} from '$lib/server/apiValidation';
import { enqueuePassportEventBestEffort } from '$lib/server/passportOutbox';
import { syncUserProfileProjection } from '$lib/server/profileProjection';
import { mapCopyTradeRunRow, type CopyTradeRunRow } from '$lib/server/copyTradeRunMapper';
import { readJsonBodySafely } from '$lib/server/requestGuards';
import { mapQuickTradeRow, type QuickTradeRow } from '$lib/server/quickTradeMapper';
import { mapTrackedSignalRow, type TrackedSignalRow } from '$lib/server/trackedSignalMapper';
import { getErrorMessage } from '$lib/utils/errorUtils';

interface CopyTradeDraftPayload {
  pair?: string;
  dir?: string;
  entry?: number;
  tp?: number[];
  sl?: number;
  note?: string;
  source?: string;
  evidence?: { conf?: number }[];
  clientMutationId?: string;
}

interface Queryable {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount?: number | null }>;
}

function calcAverageConfidence(draft: CopyTradeDraftPayload, fallback = 70): number {
  if (!Array.isArray(draft.evidence) || draft.evidence.length === 0) return fallback;
  const vals = draft.evidence
    .map((e) => (typeof e?.conf === 'number' ? e.conf : NaN))
    .filter((n) => Number.isFinite(n));
  if (vals.length === 0) return fallback;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(1, Math.min(100, Math.round(avg)));
}

async function loadExistingCopyTradeOutcome(db: Queryable, userId: string, clientMutationId: string) {
  const runResult = await db.query<CopyTradeRunRow>(
    `
      SELECT
        id, user_id, selected_signal_ids, draft, published,
        published_trade_id, published_signal_id, created_at, published_at
      FROM copy_trade_runs
      WHERE user_id = $1
        AND draft->>'clientMutationId' = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, clientMutationId]
  );
  const run = runResult.rows[0];
  if (!run?.published_trade_id || !run?.published_signal_id) return null;

  const [tradeResult, signalResult] = await Promise.all([
    db.query<QuickTradeRow>(
      `
        SELECT
          id, pair, dir, entry, tp, sl, current_price, pnl_percent,
          status, source, note, opened_at, closed_at, close_pnl
        FROM quick_trades
        WHERE id = $1
        LIMIT 1
      `,
      [run.published_trade_id]
    ),
    db.query<TrackedSignalRow>(
      `
        SELECT
          id, pair, dir, confidence, entry_price, current_price, pnl_percent,
          status, source, note, tracked_at, expires_at
        FROM tracked_signals
        WHERE id = $1
        LIMIT 1
      `,
      [run.published_signal_id]
    ),
  ]);

  const trade = tradeResult.rows[0];
  const signal = signalResult.rows[0];
  if (!trade || !signal) return null;

  return {
    run: mapCopyTradeRunRow(run),
    trade: mapQuickTradeRow(trade, { defaultSource: 'copy-trade' }),
    signal: mapTrackedSignalRow(signal, { defaultSource: 'COPY TRADE' }),
  };
}

export const POST: RequestHandler = async ({ cookies, request }) => {
  let userId = '';
  let clientMutationId = '';

  try {
    const user = await getAuthUserFromCookies(cookies);
    if (!user) return json({ error: 'Authentication required' }, { status: 401 });
    userId = user.id;

    const parsed = await readJsonBodySafely<{
      selectedSignalIds?: unknown[];
      draft?: CopyTradeDraftPayload;
      confidence?: unknown;
      clientMutationId?: unknown;
    }>(request, 32_000);
    if (!parsed.ok) return parsed.response;

    const body = parsed.body;
    const selectedSignalIds = Array.isArray(body?.selectedSignalIds)
      ? body.selectedSignalIds.filter((x: unknown) => typeof x === 'string')
      : [];
    const draft = (body?.draft && typeof body.draft === 'object' ? body.draft : {}) as CopyTradeDraftPayload;
    clientMutationId = typeof body?.clientMutationId === 'string' ? body.clientMutationId.trim() : '';

    const pair = normalizePair(draft.pair);
    const dir = normalizeTradeDir(draft.dir);
    const entry = toPositiveNumber(draft.entry, 0);
    const tp = Array.isArray(draft.tp) && draft.tp.length > 0 ? toPositiveNumber(draft.tp[0], 0) : null;
    const sl = draft.sl == null ? null : toPositiveNumber(draft.sl, 0);
    const note = typeof draft.note === 'string' ? draft.note.trim() : '';
    const source = typeof draft.source === 'string' ? draft.source.trim() : 'copy-trade';
    const confidence = toBoundedInt(body?.confidence, calcAverageConfidence(draft), 1, 100);

    if (!PAIR_RE.test(pair)) return json({ error: 'Invalid draft.pair format' }, { status: 400 });
    if (!dir) return json({ error: 'draft.dir must be LONG or SHORT' }, { status: 400 });
    if (entry <= 0) return json({ error: 'draft.entry must be greater than 0' }, { status: 400 });
    if (clientMutationId && clientMutationId.length > 128) {
      return json({ error: 'clientMutationId is too long' }, { status: 400 });
    }

    if (clientMutationId) {
      const existing = await loadExistingCopyTradeOutcome({ query }, user.id, clientMutationId);
      if (existing) {
        return json({ success: true, ...existing, reused: true });
      }
    }

    const persistedDraft = clientMutationId ? { ...draft, clientMutationId } : draft;

    const outcome = await withTransaction(async (client) => {
      if (clientMutationId) {
        const existing = await loadExistingCopyTradeOutcome(client, user.id, clientMutationId);
        if (existing) return existing;
      }

      const trade = await client.query<QuickTradeRow>(
        `
          INSERT INTO quick_trades (
            user_id, pair, dir, entry, tp, sl, current_price,
            pnl_percent, status, source, note, opened_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $4, 0, 'open', 'copy-trade', $7, now())
          RETURNING
            id, pair, dir, entry, tp, sl, current_price, pnl_percent,
            status, source, note, opened_at, closed_at, close_pnl
        `,
        [user.id, pair, dir, entry, tp, sl, note]
      );

      const signal = await client.query(
        `
          INSERT INTO tracked_signals (
            user_id, pair, dir, confidence, entry_price, current_price,
            pnl_percent, status, source, note, tracked_at, expires_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $5,
            0, 'tracking', 'COPY TRADE', $6, now(), now() + interval '24 hours'
          )
          RETURNING
            id, pair, dir, confidence, entry_price, current_price, pnl_percent,
            status, source, note, tracked_at, expires_at
        `,
        [user.id, pair, dir, confidence, entry, note]
      );

      const run = await client.query(
        `
          INSERT INTO copy_trade_runs (
            user_id, selected_signal_ids, draft, published,
            published_trade_id, published_signal_id, created_at, published_at
          )
          VALUES ($1, $2::text[], $3::jsonb, true, $4, $5, now(), now())
          RETURNING
            id, user_id, selected_signal_ids, draft, published,
            published_trade_id, published_signal_id, created_at, published_at
        `,
        [user.id, selectedSignalIds, JSON.stringify(persistedDraft), trade.rows[0].id, signal.rows[0].id]
      );

      await client.query(
        `
          INSERT INTO signal_actions (
            user_id, signal_id, linked_trade_id, pair, dir,
            action_type, source, confidence, payload, created_at
          )
          VALUES ($1, $2, $3, $4, $5, 'copy_trade', $6, $7, $8::jsonb, now())
        `,
        [
          user.id,
          signal.rows[0].id,
          trade.rows[0].id,
          pair,
          dir,
          source,
          confidence,
          JSON.stringify({ selectedSignalIds }),
        ]
      );

      await client.query(
        `
          INSERT INTO activity_events (user_id, event_type, source_page, source_id, severity, payload)
          VALUES ($1, 'copytrade_published', 'signals', $2, 'success', $3::jsonb)
        `,
        [user.id, run.rows[0].id, JSON.stringify({ pair, dir, confidence })]
      );

      await enqueuePassportEventBestEffort(
        {
          userId: user.id,
          eventType: 'copy_trade_published',
          sourceTable: 'copy_trade_runs',
          sourceId: run.rows[0].id,
          traceId: `copy-trade:${run.rows[0].id}`,
          idempotencyKey: `copy_trade_published:${run.rows[0].id}`,
          payload: {
            context: {
              pair,
              source,
              selectedSignalCount: selectedSignalIds.length,
            },
            decision: {
              dir,
              confidence,
              entry,
              tp,
              sl,
            },
            outcome: {
              publishedTradeId: trade.rows[0].id,
              publishedSignalId: signal.rows[0].id,
            },
          },
        },
        client,
      );

      await syncUserProfileProjection(user.id, client).catch(() => undefined);

      return {
        run: mapCopyTradeRunRow(run.rows[0]),
        trade: mapQuickTradeRow(trade.rows[0], { defaultSource: 'copy-trade' }),
        signal: mapTrackedSignalRow(signal.rows[0], { defaultSource: 'COPY TRADE' }),
      };
    });

    return json({
      success: true,
      run: outcome.run,
      trade: outcome.trade,
      signal: outcome.signal,
    });
  } catch (error: unknown) {
    if ((error as { code?: string } | null)?.code === '23505') {
      if (userId && clientMutationId) {
        const existing = await loadExistingCopyTradeOutcome({ query }, userId, clientMutationId);
        if (existing) {
          return json({ success: true, ...existing, reused: true });
        }
      }
    }
    if (getErrorMessage(error).includes('DATABASE_URL is not set')) {
      return json({ error: 'Server database is not configured' }, { status: 500 });
    }
    console.error('[copy-trades/publish] unexpected error:', error);
    return json({ error: 'Failed to publish copy-trade' }, { status: 500 });
  }
};
