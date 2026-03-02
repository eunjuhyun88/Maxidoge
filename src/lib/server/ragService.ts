// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — RAG Service: Save, Search, Analyze
// ═══════════════════════════════════════════════════════════════
//
// Arena War 게임 + Terminal 스캔 등 모든 활동을 256d 벡터로 저장/검색.
// pgvector 코사인 거리(<=>)로 similarity 측정.
//
// Sources:
//   - arena_war: Arena War 게임 결과
//   - terminal_scan: Terminal 8-agent 스캔 결과
//   - opportunity_scan: Opportunity Scanner 결과
//
// Graceful Degradation:
//   - 테이블 미존재: warning 반환, 크래시 없음
//   - 0 유사 게임: ragRecall null 반환
//   - 1-4 게임: recall 생성, confidenceAdj = 0
//   - 5+ 게임: 의미 있는 통계 기반 recall
//
// 비용: $0 (LLM 미사용, 순수 DB 쿼리)

import { query } from './db';
import type { RAGEntry, RAGRecall } from '$lib/engine/arenaWarTypes';
import type { Direction } from '$lib/engine/types';

// ─── Types ──────────────────────────────────────────────────

/** DB에서 반환되는 유사 게임 row */
export interface SimilarGame {
  id: string;
  pair: string;
  timeframe: string;
  regime: string;
  pattern_signature: string;
  human_direction: string;
  human_confidence: number;
  ai_direction: string;
  ai_confidence: number;
  winner: string;
  human_fbs: number;
  ai_fbs: number;
  price_change: number;
  quality: string;
  lesson: string;
  created_at: Date;
  similarity: number;
}

/** RAG 검색 옵션 */
export interface RAGSearchOptions {
  pair?: string;
  regime?: string;
  limit?: number;
  minQuality?: 'strong' | 'medium' | 'boundary' | 'weak';
}

/** RAG 저장 결과 */
export interface RAGSaveResult {
  success: boolean;
  warning?: string;
}

/** RAG 검색 + 분석 결과 */
export interface RAGSearchResult {
  games: SimilarGame[];
  recall: RAGRecall | null;
}

// ─── Error Detection ────────────────────────────────────────

function isTableMissing(e: unknown): boolean {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return msg.includes('does not exist') ||
           msg.includes('relation') ||
           msg.includes('undefined_table');
  }
  return false;
}

function isFunctionMissing(e: unknown): boolean {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return msg.includes('function') && msg.includes('does not exist');
  }
  return false;
}

// ─── Save ──────────────────────────────────────────────────

/** RAG source type */
export type RAGSource = 'arena_war' | 'terminal_scan' | 'opportunity_scan';

/**
 * RAG 엔트리를 arena_war_rag 테이블에 저장.
 * embedding을 pgvector 포맷 ([1,2,3,...]) 문자열로 변환.
 */
export async function saveRAGEntry(
  userId: string,
  gameRecordId: string,
  entry: RAGEntry,
  source: RAGSource = 'arena_war'
): Promise<RAGSaveResult> {
  try {
    // pgvector는 '[1,2,3]' 문자열 포맷으로 입력
    const embeddingStr = `[${entry.embedding.join(',')}]`;

    await query(
      `INSERT INTO arena_war_rag (
        id, user_id, source, pair, timeframe, regime, pattern_signature,
        embedding,
        human_direction, human_confidence, human_reason_tags,
        ai_direction, ai_confidence, ai_top_factors,
        winner, human_fbs, ai_fbs, price_change,
        quality, lesson, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8::vector,
        $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, to_timestamp($21 / 1000.0)
      )
      ON CONFLICT (id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        quality = EXCLUDED.quality,
        lesson = EXCLUDED.lesson`,
      [
        gameRecordId,
        userId,
        source,
        entry.pair,
        entry.timeframe,
        entry.regime,
        entry.patternSignature,
        embeddingStr,
        entry.humanDecision.direction,
        entry.humanDecision.confidence,
        JSON.stringify(entry.humanDecision.reasonTags),
        entry.aiDecision.direction,
        entry.aiDecision.confidence,
        JSON.stringify(entry.aiDecision.topFactors),
        entry.outcome.winner,
        entry.outcome.humanFBS,
        entry.outcome.aiFBS,
        entry.outcome.priceChange,
        entry.quality,
        entry.lesson,
        entry.timestamp,
      ]
    );

    return { success: true };
  } catch (e) {
    if (isTableMissing(e)) {
      console.warn('[ragService] arena_war_rag table does not exist — skipping save');
      return { success: false, warning: 'arena_war_rag table not found. Run 002_arena_war_rag.sql migration.' };
    }
    console.error('[ragService] Failed to save RAG entry:', e);
    return { success: false, warning: String(e) };
  }
}

// ─── Terminal Scan RAG Save ─────────────────────────────────

/** Terminal 스캔 결과를 RAG 엔트리로 변환/저장하기 위한 입력 */
export interface TerminalScanRAGInput {
  scanId: string;
  pair: string;
  timeframe: string;
  consensus: string;          // long | short | neutral
  avgConfidence: number;
  highlights: Array<{
    agent: string;
    vote: string;
    conf: number;
    note: string;
  }>;
  embedding: number[];
}

/**
 * Terminal 스캔 결과를 RAG에 저장.
 * Arena War와 같은 테이블, source='terminal_scan'.
 *
 * Terminal 스캔은 outcome이 없으므로 winner='pending'.
 * 나중에 가격 변동이 확인되면 업데이트 가능.
 */
export async function saveTerminalScanRAG(
  userId: string,
  input: TerminalScanRAGInput
): Promise<RAGSaveResult> {
  try {
    const embeddingStr = `[${input.embedding.join(',')}]`;

    // 에이전트 투표에서 top factors 추출
    const topFactors = input.highlights
      .filter(h => h.vote !== 'neutral')
      .sort((a, b) => b.conf - a.conf)
      .slice(0, 5)
      .map(h => h.agent.toUpperCase());

    // 레짐 추정: 에이전트 투표 패턴으로 간이 판별
    const longVotes = input.highlights.filter(h => h.vote === 'long').length;
    const shortVotes = input.highlights.filter(h => h.vote === 'short').length;
    const confSpread = Math.max(...input.highlights.map(h => h.conf)) -
                       Math.min(...input.highlights.map(h => h.conf));
    let regime = 'ranging';
    if (longVotes >= 5 && input.avgConfidence >= 65) regime = 'trending_up';
    else if (shortVotes >= 5 && input.avgConfidence >= 65) regime = 'trending_down';
    else if (confSpread > 40) regime = 'volatile';

    await query(
      `INSERT INTO arena_war_rag (
        id, user_id, source, pair, timeframe, regime, pattern_signature,
        embedding,
        human_direction, human_confidence, human_reason_tags,
        ai_direction, ai_confidence, ai_top_factors,
        winner, human_fbs, ai_fbs, price_change,
        quality, lesson, created_at
      ) VALUES (
        $1, $2, 'terminal_scan', $3, $4, $5, $6,
        $7::vector,
        $8, $9, '[]'::jsonb,
        $10, $11, $12,
        'pending', 0, 0, 0,
        $13, $14, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        ai_confidence = EXCLUDED.ai_confidence`,
      [
        `scan-${input.scanId}`,
        userId,
        input.pair,
        input.timeframe,
        regime,
        `SCAN:${input.consensus.toUpperCase()}:${topFactors.slice(0, 3).join('+')}`,
        embeddingStr,
        // Human direction = consensus (유저가 이 스캔을 요청한 것 자체가 관심 표현)
        input.consensus.toUpperCase(),
        input.avgConfidence,
        // AI direction = consensus
        input.consensus.toUpperCase(),
        input.avgConfidence,
        JSON.stringify(topFactors),
        // quality: confidence 기반 자동 분류
        input.avgConfidence >= 70 ? 'medium' :
        input.avgConfidence >= 55 ? 'boundary' : 'weak',
        `Terminal scan: ${input.pair} ${input.timeframe} → ${input.consensus} ${input.avgConfidence}%`,
      ]
    );

    return { success: true };
  } catch (e) {
    if (isTableMissing(e)) {
      console.warn('[ragService] arena_war_rag table does not exist — skipping terminal scan save');
      return { success: false, warning: 'arena_war_rag table not found' };
    }
    console.error('[ragService] Failed to save terminal scan RAG:', e);
    return { success: false, warning: String(e) };
  }
}

// ─── Search ─────────────────────────────────────────────────

/**
 * pgvector 코사인 거리로 유사 게임 검색.
 * SQL 함수 search_arena_war_rag() 사용 시도 → 실패 시 직접 쿼리 fallback.
 */
export async function searchSimilarGames(
  embedding: number[],
  userId: string,
  options: RAGSearchOptions = {}
): Promise<SimilarGame[]> {
  const { pair, regime, limit = 5, minQuality = 'weak' } = options;
  const embeddingStr = `[${embedding.join(',')}]`;

  try {
    // SQL 함수 사용 시도
    const result = await query<SimilarGame>(
      `SELECT * FROM search_arena_war_rag($1::vector, $2::uuid, $3, $4, $5, $6)`,
      [embeddingStr, userId, pair ?? null, regime ?? null, minQuality, limit]
    );
    return result.rows;
  } catch (e) {
    if (isFunctionMissing(e)) {
      // 함수 미존재 → 직접 쿼리 fallback
      console.warn('[ragService] search_arena_war_rag() not found — using direct query');
      return searchSimilarGamesDirect(embedding, userId, options);
    }
    if (isTableMissing(e)) {
      console.warn('[ragService] arena_war_rag table does not exist — returning empty');
      return [];
    }
    console.error('[ragService] RAG search failed:', e);
    return [];
  }
}

/**
 * SQL 함수 없이 직접 쿼리 (fallback).
 */
async function searchSimilarGamesDirect(
  embedding: number[],
  userId: string,
  options: RAGSearchOptions = {}
): Promise<SimilarGame[]> {
  const { pair, regime, limit = 5, minQuality = 'weak' } = options;
  const embeddingStr = `[${embedding.join(',')}]`;

  const qualityRanks: Record<string, number> = {
    strong: 1, medium: 2, boundary: 3, weak: 4,
  };
  const maxRank = qualityRanks[minQuality] ?? 4;
  const allowedQualities = Object.entries(qualityRanks)
    .filter(([, rank]) => rank <= maxRank)
    .map(([q]) => q);

  const conditions = [
    'user_id = $2',
    'embedding IS NOT NULL',
    `quality = ANY($3)`,
  ];
  const params: unknown[] = [embeddingStr, userId, allowedQualities];
  let paramIdx = 4;

  if (pair) {
    conditions.push(`pair = $${paramIdx}`);
    params.push(pair);
    paramIdx++;
  }
  if (regime) {
    conditions.push(`regime = $${paramIdx}`);
    params.push(regime);
    paramIdx++;
  }

  params.push(limit);

  try {
    const result = await query<SimilarGame>(
      `SELECT
        id, pair, timeframe, regime, pattern_signature,
        human_direction, human_confidence,
        ai_direction, ai_confidence,
        winner, human_fbs, ai_fbs, price_change,
        quality, lesson, created_at,
        1.0 - (embedding <=> $1::vector)::DOUBLE PRECISION AS similarity
      FROM arena_war_rag
      WHERE ${conditions.join(' AND ')}
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramIdx}`,
      params
    );
    return result.rows;
  } catch (e) {
    if (isTableMissing(e)) {
      return [];
    }
    console.error('[ragService] Direct RAG search failed:', e);
    return [];
  }
}

// ─── Analyze (Compute RAGRecall) ────────────────────────────

/**
 * 유사 게임들로부터 RAGRecall 통계 계산.
 *
 * - 5+ 게임: 통계적으로 의미 있는 recall
 * - 1-4 게임: recall 생성하되 confidenceAdj = 0
 * - 0 게임: null 반환
 */
export function computeRAGRecall(
  similarGames: SimilarGame[],
  currentDirection: Direction,
  currentConfidence: number
): RAGRecall | null {
  if (similarGames.length === 0) return null;

  // 패턴 시그니처 수집
  const queriedPatterns = [
    ...new Set(similarGames.map(g => g.pattern_signature).filter(Boolean)),
  ];

  // 같은 방향을 택한 과거 게임들의 승률
  const sameDirectionGames = similarGames.filter(
    g => g.ai_direction === currentDirection
  );
  const sameDirectionWins = sameDirectionGames.filter(
    g => g.winner === 'ai'
  ).length;
  const historicalWinRate = sameDirectionGames.length > 0
    ? sameDirectionWins / sameDirectionGames.length
    : 0.5;

  // 가장 많이 승리한 방향 추천
  const directionWins: Record<string, number> = {};
  for (const g of similarGames) {
    const winDir = g.winner === 'ai' ? g.ai_direction : g.human_direction;
    directionWins[winDir] = (directionWins[winDir] ?? 0) + 1;
  }
  const suggestedDirection = (
    Object.entries(directionWins).sort((a, b) => b[1] - a[1])[0]?.[0] ?? currentDirection
  ) as Direction;

  // Confidence 조정 (5+ 게임부터 의미 있음)
  let confidenceAdjustment = 0;
  if (similarGames.length >= 5) {
    // winRate가 0.7 이상이면 confidence 증가, 0.3 이하면 감소
    if (historicalWinRate >= 0.7) {
      confidenceAdjustment = Math.min(10, Math.round((historicalWinRate - 0.5) * 20));
    } else if (historicalWinRate <= 0.3) {
      confidenceAdjustment = Math.max(-10, Math.round((historicalWinRate - 0.5) * 20));
    }
    // 방향이 다르면 경고성 감소
    if (suggestedDirection !== currentDirection && historicalWinRate < 0.4) {
      confidenceAdjustment = Math.min(confidenceAdjustment, -5);
    }
  }

  return {
    queriedPatterns,
    similarGamesFound: similarGames.length,
    historicalWinRate: Math.round(historicalWinRate * 100) / 100,
    suggestedDirection,
    confidenceAdjustment,
  };
}

// ─── Combined Search + Analyze ──────────────────────────────

/**
 * 임베딩으로 유사 게임 검색 + RAGRecall 생성.
 * 원스톱 API — gameRecordStore에서 호출.
 */
export async function searchAndAnalyze(
  embedding: number[],
  userId: string,
  currentDirection: Direction,
  currentConfidence: number,
  options: RAGSearchOptions = {}
): Promise<RAGSearchResult> {
  const games = await searchSimilarGames(embedding, userId, options);
  const recall = computeRAGRecall(games, currentDirection, currentConfidence);

  return { games, recall };
}
