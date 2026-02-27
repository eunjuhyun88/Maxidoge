// ═══════════════════════════════════════════════════════════════
// Stockclaw — Arena Signal Bridge (B-01)
// Arena → Signal → Follow → Copy Trade pipeline
// ═══════════════════════════════════════════════════════════════
//
// Match 결과를 ArenaSignal로 자동 발행.
// 팔로워 피드에 노출 → Copy Trade 연계.

import { query } from '$lib/server/db';
import { randomUUID } from 'node:crypto';
import type {
  ArenaSignal,
  MatchResult,
  MatchState,
  DraftSelection,
  Direction,
} from '$lib/engine/types';

// ── DB error helper ─────────────────────────────────────────

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

// ── Draft Summary Builder ───────────────────────────────────

function buildDraftSummary(draft: DraftSelection[] | null): string {
  if (!draft || draft.length === 0) return '';
  return draft.map(d => `${d.agentId}(${d.weight})`).join(' + ');
}

// ── Publish Match As Signal ─────────────────────────────────

export interface PublishSignalInput {
  userId: string;
  matchId: string;
  matchResult: MatchResult;
  matchState: Partial<MatchState>;
}

/**
 * Publish a resolved match as an arena signal.
 * Called after match resolve, either automatically or manually.
 */
export async function publishMatchAsSignal(
  input: PublishSignalInput,
): Promise<{ signalId: string; signal: ArenaSignal } | null> {
  const { userId, matchId, matchResult, matchState } = input;

  const direction: Direction = matchState.userAPrediction?.direction ?? 'NEUTRAL';
  const fbs = matchResult.userAScore.fbs;
  const isWin = matchResult.winnerId === userId;
  const draftSummary = buildDraftSummary(matchState.userADraft ?? null);
  const exitStrategy = matchState.userAPrediction?.exitStrategy;
  const priceChangePct = matchState.priceChange !== null && matchState.priceChange !== undefined
    ? matchState.priceChange * 100
    : null;

  const signalId = randomUUID();

  const signal: ArenaSignal = {
    id: signalId,
    userId,
    matchId,
    pair: matchState.pair ?? 'BTC/USDT',
    direction,
    fbs,
    isWin,
    draftSummary,
    exitStrategy,
    entryPrice: matchState.entryPrice ?? undefined,
    exitPrice: matchState.exitPrice ?? undefined,
    priceChangePct: priceChangePct ?? undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await query(
      `INSERT INTO arena_signals
         (id, user_id, match_id, pair, direction, fbs, is_win, draft_summary,
          exit_strategy, entry_price, exit_price, price_change_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        signalId, userId, matchId,
        signal.pair, direction, fbs, isWin, draftSummary,
        exitStrategy ?? null,
        matchState.entryPrice ?? null,
        matchState.exitPrice ?? null,
        priceChangePct,
      ],
    );
  } catch (err: unknown) {
    if (isTableError(err)) return null;
    throw err;
  }

  return { signalId, signal };
}

// ── Get Followed Users' Signals (Feed) ──────────────────────

export interface SignalFeedOptions {
  userId: string;
  limit?: number;
  offset?: number;
  pair?: string;
}

export interface SignalFeedResult {
  signals: (ArenaSignal & { displayName: string; tier: string })[];
  total: number;
}

/**
 * Get arena signals from users that the current user follows.
 */
export async function getFollowedSignals(
  options: SignalFeedOptions,
): Promise<SignalFeedResult> {
  const { userId, limit = 20, offset = 0, pair } = options;

  const conditions = [
    `s.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $1)`,
  ];
  const params: unknown[] = [userId];
  let paramIdx = 2;

  if (pair) {
    conditions.push(`s.pair = $${paramIdx}`);
    params.push(pair.toUpperCase().trim());
    paramIdx++;
  }

  const where = conditions.join(' AND ');

  try {
    const countRes = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM arena_signals s WHERE ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]?.total ?? '0');

    const res = await query<any>(
      `SELECT s.*, p.display_name, p.tier
       FROM arena_signals s
       LEFT JOIN user_passports p ON p.user_id = s.user_id
       WHERE ${where}
       ORDER BY s.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );

    return {
      total,
      signals: res.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        matchId: r.match_id,
        pair: r.pair,
        direction: r.direction as Direction,
        fbs: Number(r.fbs),
        isWin: r.is_win,
        draftSummary: r.draft_summary ?? '',
        exitStrategy: r.exit_strategy,
        entryPrice: r.entry_price ? Number(r.entry_price) : undefined,
        exitPrice: r.exit_price ? Number(r.exit_price) : undefined,
        priceChangePct: r.price_change_pct ? Number(r.price_change_pct) : undefined,
        createdAt: r.created_at,
        displayName: r.display_name ?? 'Anonymous',
        tier: r.tier ?? 'BRONZE',
      })),
    };
  } catch (err: unknown) {
    if (isTableError(err)) return { signals: [], total: 0 };
    throw err;
  }
}

// ── Get User's Own Arena Signals ────────────────────────────

export async function getUserArenaSignals(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<{ signals: ArenaSignal[]; total: number }> {
  try {
    const countRes = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM arena_signals WHERE user_id = $1`,
      [userId],
    );
    const total = Number(countRes.rows[0]?.total ?? '0');

    const res = await query<any>(
      `SELECT * FROM arena_signals WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    return {
      total,
      signals: res.rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        matchId: r.match_id,
        pair: r.pair,
        direction: r.direction as Direction,
        fbs: Number(r.fbs),
        isWin: r.is_win,
        draftSummary: r.draft_summary ?? '',
        exitStrategy: r.exit_strategy,
        entryPrice: r.entry_price ? Number(r.entry_price) : undefined,
        exitPrice: r.exit_price ? Number(r.exit_price) : undefined,
        priceChangePct: r.price_change_pct ? Number(r.price_change_pct) : undefined,
        createdAt: r.created_at,
      })),
    };
  } catch (err: unknown) {
    if (isTableError(err)) return { signals: [], total: 0 };
    throw err;
  }
}
