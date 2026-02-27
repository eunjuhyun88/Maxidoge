// ═══════════════════════════════════════════════════════════════
// Stockclaw — RAG Memory Service (B-01 → Phase 3 pgvector)
// Match memories: store, search, and retrieve past match outcomes
// Phase 1: text-based search ✓
// Phase 3: pgvector cosine similarity ✓ + 4-way search modes
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
import { RAG_MEMORY_TOP_K, RAG_EMBEDDING_DIM } from '$lib/engine/constants';
import { generateEmbedding, buildMemoryText, toPgVector } from './embeddingService';

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
      // Phase 3: Generate embedding for cosine similarity search
      const memoryText = buildMemoryText({
        pair: input.pair,
        direction: output.direction,
        confidence: output.confidence,
        thesis: output.thesis,
        agentId: output.agentId,
        marketRegime: input.marketRegime,
        outcome: agentOutcome,
        lesson: input.lesson,
      });

      let embeddingParam: string | null = null;
      try {
        const embResult = await generateEmbedding(memoryText);
        embeddingParam = toPgVector(embResult.embedding);
      } catch {
        // embedding failure is non-fatal — store memory without vector
      }

      await query(
        `INSERT INTO match_memories
           (user_id, agent_id, spec_id, pair, match_id, market_state, market_regime,
            direction, confidence, factors, thesis, outcome, price_change, lesson, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11, $12, $13, $14,
                 $15::vector)`,
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
          embeddingParam,
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

export type MemorySearchMode =
  | 'similar_all'           // 유사한 모든 기억
  | 'similar_failures'      // 유사 실패 기억 (같은 실수 반복 방지)
  | 'cross_agent'           // 다른 agent의 기억 (cross-pollination)
  | 'spec_agnostic';        // agent 무관, pair+regime 기반 검색

export interface MemorySearchOptions {
  userId: string;
  agentId?: AgentId;
  pair?: string;
  outcomeFilter?: boolean;     // true = wins only, false = losses only, undefined = all
  limit?: number;
  /** Phase 3: query text for embedding-based search */
  queryText?: string;
  /** Phase 3: search mode (default: similar_all) */
  mode?: MemorySearchMode;
}

export interface MemorySearchResult {
  memories: MatchMemory[];
  total: number;
  searchMode: MemorySearchMode;
}

function rowToMemory(row: any): MatchMemory {
  return {
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
    embedding: row.embedding ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * Search memories with 4-way search modes.
 * Phase 3: pgvector cosine similarity when queryText provided.
 * Fallback: text-based filter when embedding unavailable.
 */
export async function searchSimilarMemories(
  options: MemorySearchOptions,
): Promise<MemorySearchResult> {
  const limit = options.limit ?? RAG_MEMORY_TOP_K;
  const mode = options.mode ?? 'similar_all';

  // Try pgvector search first if queryText provided
  if (options.queryText) {
    try {
      const embResult = await generateEmbedding(options.queryText);
      if (embResult.provider !== 'hash') {
        return await vectorSearch(options, embResult.embedding, limit, mode);
      }
    } catch {
      // embedding failed — fall through to text-based search
    }
  }

  // Fallback: text-based search
  return textSearch(options, limit, mode);
}

/** pgvector cosine similarity search */
async function vectorSearch(
  options: MemorySearchOptions,
  queryEmbedding: number[],
  limit: number,
  mode: MemorySearchMode,
): Promise<MemorySearchResult> {
  const conditions: string[] = ['user_id = $1', 'is_active = true', 'embedding IS NOT NULL'];
  const params: unknown[] = [options.userId];
  let paramIdx = 2;

  // Apply mode-specific filters
  switch (mode) {
    case 'similar_failures':
      conditions.push('outcome = false');
      break;
    case 'cross_agent':
      if (options.agentId) {
        conditions.push(`agent_id != $${paramIdx}`);
        params.push(options.agentId);
        paramIdx++;
      }
      break;
    case 'spec_agnostic':
      // No agent filter — search across all agents
      if (options.pair) {
        conditions.push(`pair = $${paramIdx}`);
        params.push(options.pair);
        paramIdx++;
      }
      break;
    case 'similar_all':
    default:
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
      break;
  }

  if (options.outcomeFilter !== undefined) {
    conditions.push(`outcome = $${paramIdx}`);
    params.push(options.outcomeFilter);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const vecParam = `$${paramIdx}`;
  params.push(toPgVector(queryEmbedding));
  paramIdx++;

  try {
    const countRes = await query<{ total: string }>(
      `SELECT count(*)::text AS total FROM match_memories WHERE ${where}`,
      params.slice(0, -1), // exclude embedding param from count
    );
    const total = Number(countRes.rows[0]?.total ?? '0');

    const res = await query<any>(
      `SELECT *, (embedding <=> ${vecParam}::vector) AS distance
       FROM match_memories
       WHERE ${where}
       ORDER BY embedding <=> ${vecParam}::vector ASC
       LIMIT $${paramIdx}`,
      [...params, limit],
    );

    return {
      memories: res.rows.map(rowToMemory),
      total,
      searchMode: mode,
    };
  } catch (err: unknown) {
    if (isTableError(err)) return { memories: [], total: 0, searchMode: mode };
    // If vector search fails (e.g., index issue), fall through to text search
    console.warn('[ragMemory] vector search failed, falling back to text:', err);
    return textSearch(options, limit, mode);
  }
}

/** Text-based search (Phase 1 fallback) */
async function textSearch(
  options: MemorySearchOptions,
  limit: number,
  mode: MemorySearchMode,
): Promise<MemorySearchResult> {
  const conditions: string[] = ['user_id = $1', 'is_active = true'];
  const params: unknown[] = [options.userId];
  let paramIdx = 2;

  switch (mode) {
    case 'similar_failures':
      conditions.push('outcome = false');
      break;
    case 'cross_agent':
      if (options.agentId) {
        conditions.push(`agent_id != $${paramIdx}`);
        params.push(options.agentId);
        paramIdx++;
      }
      break;
    case 'spec_agnostic':
      if (options.pair) {
        conditions.push(`pair = $${paramIdx}`);
        params.push(options.pair);
        paramIdx++;
      }
      break;
    case 'similar_all':
    default:
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
      break;
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

    return {
      memories: res.rows.map(rowToMemory),
      total,
      searchMode: mode,
    };
  } catch (err: unknown) {
    if (isTableError(err)) return { memories: [], total: 0, searchMode: mode };
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
