// ═══════════════════════════════════════════════════════════════
// Stockclaw — RAG Memory Service (B-01)
// Match memories: store, search, and retrieve past match outcomes
// Phase 1: text-based search. Phase 3: pgvector cosine similarity.
// ═══════════════════════════════════════════════════════════════

import { query } from '$lib/server/db';
import type {
  AgentId,
  AgentOutput,
  MatchMemory,
  MarketRegime,
  MatchState,
  Direction,
  FactorResult,
  TrendAnalysis,
} from '$lib/engine/types';
import { RAG_MEMORY_TOP_K } from '$lib/engine/constants';

// ── DB error helper ─────────────────────────────────────────

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

// ── Store Match Memories ────────────────────────────────────

export interface StoreMemoryInput {
  userId: string;
  matchId: string;
  pair: string;
  marketRegime: MarketRegime | null;
  agentOutputs: AgentOutput[];
  userDirection: Direction;
  outcome: boolean;            // true = user won
  priceChange: number;         // decimal (e.g., 0.023 = 2.3%)
  lesson?: string;             // user-provided or LLM-generated
}

/**
 * Store match memories — one per agent that participated.
 * Each agent's output becomes a memory linked to the match.
 */
export async function storeMatchMemories(input: StoreMemoryInput): Promise<{ stored: number }> {
  let stored = 0;

  for (const output of input.agentOutputs) {
    const agentOutcome = (
      (output.direction === 'LONG' && input.priceChange > 0) ||
      (output.direction === 'SHORT' && input.priceChange < 0)
    );

    // Build market state snapshot from factors
    const marketState: Record<string, { value: number; trend?: TrendAnalysis }> = {};
    for (const f of output.factors) {
      marketState[f.factorId] = {
        value: f.value,
        trend: f.trend,
      };
    }

    try {
      await query(
        `INSERT INTO match_memories
           (user_id, agent_id, spec_id, pair, match_id, market_state, market_regime,
            direction, confidence, factors, thesis, outcome, price_change, lesson)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11, $12, $13, $14)`,
        [
          input.userId,
          output.agentId,
          output.specId,
          input.pair,
          input.matchId,
          JSON.stringify(marketState),
          input.marketRegime,
          output.direction,
          output.confidence,
          JSON.stringify(output.factors),
          output.thesis,
          agentOutcome,
          input.priceChange,
          input.lesson ?? null,
        ]
      );
      stored++;
    } catch (err: unknown) {
      if (!isTableError(err)) {
        console.warn(`[ragMemory] failed to store memory for ${output.agentId}:`, err);
      }
    }
  }

  return { stored };
}

// ── Search Similar Memories ─────────────────────────────────

export interface MemorySearchOptions {
  userId: string;
  agentId?: AgentId;
  pair?: string;
  outcomeFilter?: boolean;     // true = wins only, false = losses only, undefined = all
  limit?: number;
}

export interface MemorySearchResult {
  memories: MatchMemory[];
  total: number;
}

/**
 * Search memories by agent + pair (Phase 1: text-based).
 * Phase 3 will add pgvector cosine similarity search.
 */
export async function searchSimilarMemories(
  options: MemorySearchOptions,
): Promise<MemorySearchResult> {
  const limit = options.limit ?? RAG_MEMORY_TOP_K;
  const conditions: string[] = ['user_id = $1', 'is_active = true'];
  const params: unknown[] = [options.userId];
  let paramIdx = 2;

  if (options.agentId) {
    conditions.push(`agent_id = $${paramIdx}`);
    params.push(options.agentId);
    paramIdx++;
  }

  if (options.pair) {
    conditions.push(`pair = $${paramIdx}`);
    params.push(options.pair);
    paramIdx++;
  }

  if (options.outcomeFilter !== undefined) {
    conditions.push(`outcome = $${paramIdx}`);
    params.push(options.outcomeFilter);
    paramIdx++;
  }

  const where = conditions.join(' AND ');

  try {
    const countRes = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM match_memories WHERE ${where}`,
      params,
    );
    const total = Number(countRes.rows[0]?.total ?? '0');

    const res = await query<any>(
      `SELECT * FROM match_memories
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx}`,
      [...params, limit],
    );

    const memories: MatchMemory[] = res.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id as AgentId,
      specId: row.spec_id,
      pair: row.pair,
      matchId: row.match_id,
      marketState: row.market_state,
      marketRegime: row.market_regime,
      direction: row.direction,
      confidence: Number(row.confidence),
      factors: row.factors ?? [],
      thesis: row.thesis ?? '',
      outcome: row.outcome,
      priceChange: Number(row.price_change),
      lesson: row.lesson ?? '',
      isActive: row.is_active,
      createdAt: row.created_at,
    }));

    return { memories, total };
  } catch (err: unknown) {
    if (isTableError(err)) return { memories: [], total: 0 };
    throw err;
  }
}

// ── Get Agent Memory Stats ──────────────────────────────────

export interface AgentMemoryStats {
  agentId: AgentId;
  totalMemories: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  topPairs: string[];
}

/**
 * Get memory stats for a specific agent+user combo.
 */
export async function getAgentMemoryStats(
  userId: string,
  agentId: AgentId,
): Promise<AgentMemoryStats | null> {
  try {
    const res = await query<{
      total: string;
      wins: string;
      losses: string;
      top_pairs: string[];
    }>(
      `SELECT
         count(*)::text AS total,
         count(*) FILTER (WHERE outcome = true)::text AS wins,
         count(*) FILTER (WHERE outcome = false)::text AS losses,
         ARRAY(
           SELECT pair FROM match_memories
           WHERE user_id = $1 AND agent_id = $2 AND is_active = true
           GROUP BY pair ORDER BY count(*) DESC LIMIT 3
         ) AS top_pairs
       FROM match_memories
       WHERE user_id = $1 AND agent_id = $2 AND is_active = true`,
      [userId, agentId],
    );

    const row = res.rows[0];
    if (!row) return null;

    const total = Number(row.total);
    const wins = Number(row.wins);

    return {
      agentId,
      totalMemories: total,
      winCount: wins,
      lossCount: Number(row.losses),
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      topPairs: row.top_pairs ?? [],
    };
  } catch (err: unknown) {
    if (isTableError(err)) return null;
    throw err;
  }
}

// ── Deactivate Memory ───────────────────────────────────────

/**
 * Soft-delete a memory (set is_active = false).
 * Master tier users can curate their memory library.
 */
export async function deactivateMemory(
  userId: string,
  memoryId: string,
): Promise<boolean> {
  try {
    const res = await query(
      `UPDATE match_memories SET is_active = false
       WHERE id = $1 AND user_id = $2`,
      [memoryId, userId],
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err: unknown) {
    if (isTableError(err)) return false;
    throw err;
  }
}
