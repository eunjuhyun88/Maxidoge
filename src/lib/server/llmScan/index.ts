// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Public API
// ═══════════════════════════════════════════════════════════════
//
// Single entry point: runLLMScan(pair, timeframe) → WarRoomScanResult
//
// Pipeline:
//   1. buildMarketSnapshot() — 15 API data collection
//   2. RAG 조회 — 유사 과거 패턴 검색
//   3. runOrchestration() — 3-level LLM calls (8+2+1)
//   4. mapToWarRoomScanResult() — output conversion
//
// Cost: ~$0.012/scan, Latency: +3~5s over B-02

import type { WarRoomScanResult } from '$lib/server/scanEngine';
import { buildMarketSnapshot } from './marketSnapshotBuilder';
import { runOrchestration } from './agentOrchestrator';
import { mapToWarRoomScanResult } from './outputMapper';
import type { RAGScanResult } from './types';

// Re-export config utilities
export { shouldUseLLMScan, getLLMScanConfig } from './config';

// ─── RAG Integration (optional, graceful degradation) ───────

async function queryRAG(
  pair: string,
  timeframe: string,
): Promise<RAGScanResult | null> {
  try {
    // Dynamic import to avoid hard dependency on ragService
    // (tables may not exist in all environments)
    const { computeTerminalScanEmbedding } = await import('$lib/engine/ragEmbedding');
    const { searchSimilarGames } = await import('$lib/server/ragService');

    // Generate a lightweight embedding for similarity search
    // Uses the same 256d embedding as B-02 RAG pipeline
    const scanSignals = [
      { agentId: 'STRUCTURE', vote: 'neutral' as const, confidence: 50 },
    ]; // Placeholder — actual agent results come after L1
    const embedding = computeTerminalScanEmbedding(scanSignals, timeframe);

    // Note: searchSimilarGames requires userId, but for C-02 we do
    // a broader search. We use a special system userId for scan RAG.
    // For now, return null to avoid DB dependency issues.
    // TODO: Implement RAG query with scan-specific embedding after L1 results
    void embedding;
    void searchSimilarGames;
    return null;
  } catch {
    // RAG not available — proceed without historical context
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Run the C-02 LLM scan pipeline.
 *
 * @param pair - Trading pair (e.g., 'BTC/USDT')
 * @param timeframe - Timeframe (e.g., '4h')
 * @returns WarRoomScanResult — same type as B-02, compatible with all UI
 *
 * @throws Error if data collection fails
 * @throws Error if too few agents succeed (below minSuccessfulAgents)
 */
export async function runLLMScan(
  pair: string,
  timeframe: string,
): Promise<WarRoomScanResult> {
  const startMs = Date.now();

  // Step 1: Data collection (same as B-02, shared cache)
  const snapshot = await buildMarketSnapshot(pair, timeframe);
  const dataMs = Date.now() - startMs;

  // Step 2: RAG query (optional, non-blocking on failure)
  const rag = await queryRAG(pair, timeframe);

  // Step 3: 3-level LLM orchestration
  const orchestration = await runOrchestration(snapshot, rag);
  const llmMs = Date.now() - startMs - dataMs;

  // Step 4: Map to WarRoomScanResult
  const result = mapToWarRoomScanResult(snapshot, orchestration);

  // Performance logging
  const totalMs = Date.now() - startMs;
  console.log(
    `[C-02] ${pair} ${timeframe} — ` +
    `${orchestration.commander.direction.toUpperCase()} ${orchestration.commander.confidence}% · ` +
    `L1: ${orchestration.meta.level1SuccessCount}/${orchestration.meta.totalAgents} · ` +
    `data: ${dataMs}ms, llm: ${llmMs}ms, total: ${totalMs}ms`,
  );

  return result;
}
