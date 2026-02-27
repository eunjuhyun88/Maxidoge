// ═══════════════════════════════════════════════════════════════
// Stockclaw — PvP Matching Service (B-01)
// Async PvP queue: same market data, different time.
// Tier-based matching (±1 tier).
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';
import { query } from '$lib/server/db';
import { createMatch } from '$lib/server/arenaService';
import type {
  DraftSelection,
  Tier,
  PvPPoolEntry,
  PvPPoolStatus,
  ArenaMatchMode,
} from '$lib/engine/types';
import {
  PVP_QUEUE_TIMEOUT_MIN,
  PVP_MAX_CONCURRENT,
  PVP_TIER_RANGE,
} from '$lib/engine/constants';

// ── DB error helper ─────────────────────────────────────────

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

// ── Tier Ordering (for ±1 range matching) ───────────────────

const TIER_ORDER: Tier[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'MASTER'];

function getTierIndex(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

function getMatchableTiers(tier: Tier): Tier[] {
  const idx = getTierIndex(tier);
  const result: Tier[] = [tier];
  if (idx > 0) result.push(TIER_ORDER[idx - 1]);
  if (idx < TIER_ORDER.length - 1) result.push(TIER_ORDER[idx + 1]);
  return result;
}

// ── Join Queue ──────────────────────────────────────────────

export interface JoinQueueInput {
  pair: string;
  timeframe: string;
  draft: DraftSelection[];
  tier: Tier;
}

export interface JoinQueueResult {
  poolEntryId: string;
  status: PvPPoolStatus;
  matchId: string | null;       // non-null if instantly matched
  expiresAt: string;
}

/**
 * Join the PvP queue. Attempts instant matching, falls back to WAITING.
 */
export async function joinQueue(
  userId: string,
  input: JoinQueueInput,
): Promise<JoinQueueResult> {
  const pair = input.pair.toUpperCase().trim();
  const timeframe = input.timeframe.toLowerCase().trim();
  const matchableTiers = getMatchableTiers(input.tier);
  const expiresAt = new Date(Date.now() + PVP_QUEUE_TIMEOUT_MIN * 60_000).toISOString();

  // Check concurrent PvP limit
  try {
    const activeRes = await query<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM pvp_match_pool
       WHERE user_id = $1 AND status IN ('WAITING', 'MATCHED')`,
      [userId],
    );
    const activeCnt = Number(activeRes.rows[0]?.cnt ?? '0');
    if (activeCnt >= PVP_MAX_CONCURRENT) {
      throw new Error(`Maximum ${PVP_MAX_CONCURRENT} concurrent PvP queues reached`);
    }
  } catch (err: unknown) {
    if (!isTableError(err)) throw err;
  }

  // Try instant match: find WAITING opponent with same pair, matchable tier
  let matchedEntry: { id: string; user_id: string; draft: DraftSelection[]; tier: Tier } | null = null;
  try {
    const tierPlaceholders = matchableTiers.map((_, i) => `$${i + 4}`).join(',');
    const res = await query<any>(
      `SELECT id, user_id, draft, tier FROM pvp_match_pool
       WHERE pair = $1 AND status = 'WAITING' AND user_id != $2
         AND expires_at > now()
         AND tier IN (${tierPlaceholders})
       ORDER BY created_at ASC LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [pair, userId, timeframe, ...matchableTiers],
    );
    matchedEntry = res.rows[0] ?? null;
  } catch (err: unknown) {
    if (!isTableError(err)) console.warn('[pvpMatching] instant match lookup failed:', err);
  }

  const poolEntryId = randomUUID();

  if (matchedEntry) {
    // Instant match! Create arena match with mode PVP
    const matchResult = await createMatch(userId, { pair, timeframe, mode: 'PVP' as ArenaMatchMode });
    const matchId = matchResult.matchId;

    // Update opponent's pool entry
    try {
      await query(
        `UPDATE pvp_match_pool SET status = 'MATCHED', match_id = $1 WHERE id = $2`,
        [matchId, matchedEntry.id],
      );
    } catch (err: unknown) {
      if (!isTableError(err)) console.warn('[pvpMatching] opponent update failed:', err);
    }

    // Insert our entry as MATCHED
    try {
      await query(
        `INSERT INTO pvp_match_pool (id, user_id, pair, timeframe, tier, draft, status, match_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'MATCHED', $7, $8)`,
        [poolEntryId, userId, pair, timeframe, input.tier, JSON.stringify(input.draft), matchId, expiresAt],
      );
    } catch (err: unknown) {
      if (!isTableError(err)) console.warn('[pvpMatching] pool insert failed:', err);
    }

    // Set user_b on the arena match
    try {
      await query(
        `UPDATE arena_matches SET user_b_id = $1, user_b_draft = $2::jsonb WHERE id = $3`,
        [matchedEntry.user_id, JSON.stringify(matchedEntry.draft), matchId],
      );
    } catch (err: unknown) {
      if (!isTableError(err)) console.warn('[pvpMatching] match user_b update failed:', err);
    }

    return {
      poolEntryId,
      status: 'MATCHED',
      matchId,
      expiresAt,
    };
  }

  // No instant match — enter WAITING
  try {
    await query(
      `INSERT INTO pvp_match_pool (id, user_id, pair, timeframe, tier, draft, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'WAITING', $7)`,
      [poolEntryId, userId, pair, timeframe, input.tier, JSON.stringify(input.draft), expiresAt],
    );
  } catch (err: unknown) {
    if (!isTableError(err)) throw err;
  }

  return {
    poolEntryId,
    status: 'WAITING',
    matchId: null,
    expiresAt,
  };
}

// ── Leave Queue ─────────────────────────────────────────────

export async function leaveQueue(
  userId: string,
  poolEntryId: string,
): Promise<boolean> {
  try {
    const res = await query(
      `UPDATE pvp_match_pool SET status = 'CANCELLED'
       WHERE id = $1 AND user_id = $2 AND status = 'WAITING'`,
      [poolEntryId, userId],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err: unknown) {
    if (isTableError(err)) return false;
    throw err;
  }
}

// ── Get Queue Status ────────────────────────────────────────

export interface QueueStatusResult {
  entries: PvPPoolEntry[];
  total: number;
}

export async function getQueueStatus(
  userId: string,
): Promise<QueueStatusResult> {
  try {
    const res = await query<any>(
      `SELECT id, user_id, pair, timeframe, tier, draft, status, match_id, created_at, expires_at
       FROM pvp_match_pool
       WHERE user_id = $1 AND status IN ('WAITING', 'MATCHED')
       ORDER BY created_at DESC`,
      [userId],
    );

    return {
      entries: res.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        pair: row.pair,
        timeframe: row.timeframe,
        tier: row.tier,
        draft: row.draft ?? [],
        status: row.status,
        matchId: row.match_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })),
      total: res.rows.length,
    };
  } catch (err: unknown) {
    if (isTableError(err)) return { entries: [], total: 0 };
    throw err;
  }
}

// ── Expire Old Queue Entries ────────────────────────────────

/**
 * Expire WAITING entries past their deadline. Run periodically.
 */
export async function expireQueueEntries(): Promise<number> {
  try {
    const res = await query(
      `UPDATE pvp_match_pool SET status = 'EXPIRED'
       WHERE status = 'WAITING' AND expires_at < now()`,
    );
    return res.rowCount ?? 0;
  } catch (err: unknown) {
    if (isTableError(err)) return 0;
    throw err;
  }
}
