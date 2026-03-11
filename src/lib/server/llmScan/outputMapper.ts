// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Output Mapper
// ═══════════════════════════════════════════════════════════════
//
// Maps C-02 LLM orchestration results → WarRoomScanResult.
// The output type is IDENTICAL to B-02, so all downstream UI
// components work without changes.

import type { AgentSignal } from '$lib/data/warroom';
import type { AgentId } from '$lib/engine/types';
import { AGENT_POOL } from '$lib/engine/agents';
import type { WarRoomScanResult, ScanHighlight } from '$lib/server/scanEngine';
import type { AgentVerdict, CommanderDecision, MarketSnapshot } from './types';
import type { OrchestratorResult } from './agentOrchestrator';

// ─── Agent metadata (matches scanEngine.ts AGENT_META) ──────

const AGENT_META: Record<string, { icon: string; name: string; color: string }> = {
  STRUCTURE: { icon: 'STR', name: AGENT_POOL.STRUCTURE.name, color: AGENT_POOL.STRUCTURE.color },
  FLOW: { icon: 'FLOW', name: AGENT_POOL.FLOW.name, color: AGENT_POOL.FLOW.color },
  DERIV: { icon: 'DER', name: AGENT_POOL.DERIV.name, color: AGENT_POOL.DERIV.color },
  SENTI: { icon: 'SENT', name: AGENT_POOL.SENTI.name, color: AGENT_POOL.SENTI.color },
  MACRO: { icon: 'MACRO', name: AGENT_POOL.MACRO.name, color: AGENT_POOL.MACRO.color },
  VPA: { icon: 'VPA', name: AGENT_POOL.VPA.name, color: AGENT_POOL.VPA.color },
  ICT: { icon: 'ICT', name: AGENT_POOL.ICT.name, color: AGENT_POOL.ICT.color },
  VALUATION: { icon: 'VAL', name: AGENT_POOL.VALUATION.name, color: AGENT_POOL.VALUATION.color },
};

// ─── Data source labels per agent ───────────────────────────

const AGENT_SOURCE: Record<string, string> = {
  STRUCTURE: 'BINANCE:TECHNICAL',
  VPA: 'BINANCE:VOLUME',
  ICT: 'BINANCE:ICT',
  DERIV: 'COINALYZE:PERP',
  FLOW: 'ONCHAIN:FLOW',
  SENTI: 'SOCIAL:SENTIMENT',
  MACRO: 'MACRO:GLOBAL',
  VALUATION: 'ONCHAIN:VALUATION',
};

// ─── Mapper ─────────────────────────────────────────────────

/**
 * Map C-02 orchestration results to WarRoomScanResult.
 * Output is fully compatible with B-02 downstream consumers.
 */
export function mapToWarRoomScanResult(
  snapshot: MarketSnapshot,
  orchestration: OrchestratorResult,
): WarRoomScanResult {
  const { verdicts, commander } = orchestration;
  const now = snapshot.timestamp;
  const timeLabel = new Date(now).toTimeString().slice(0, 5);
  const scanRunId = `c02-${now}-${Math.floor(Math.random() * 1_000_000).toString(16)}`;

  // Map 8 agent verdicts → AgentSignal[]
  const signals: AgentSignal[] = verdicts.map((verdict) => {
    const meta = AGENT_META[verdict.agentId] ?? {
      icon: verdict.agentId.slice(0, 3),
      name: verdict.agentId,
      color: '#888888',
    };
    const src = AGENT_SOURCE[verdict.agentId] ?? 'LLM:C-02';

    return {
      id: `${verdict.agentId.toLowerCase()}-${scanRunId}`,
      agentId: verdict.agentId.toLowerCase(),
      icon: meta.icon,
      name: meta.name,
      color: meta.color,
      token: snapshot.token,
      pair: snapshot.pair,
      vote: verdict.direction,
      conf: verdict.confidence,
      text: verdict.reasoning,     // LLM-generated natural language
      src,
      time: timeLabel,
      entry: commander.entry,      // All agents share Commander's entry
      tp: commander.tp,
      sl: commander.sl,
    };
  });

  // Consensus from Commander decision
  const consensus = commander.direction;
  const avgConfidence = Math.round(
    verdicts.reduce((sum, v) => sum + v.confidence, 0) / Math.max(verdicts.length, 1),
  );

  // Summary: combine commander reasoning with key stats + MTF
  const summary = [
    `[C-02] ${consensus.toUpperCase()} ${commander.confidence}%`,
    commander.reasoning,
    snapshot.mtf
      ? `MTF: ${snapshot.mtf.consensusBias.toUpperCase()} ${snapshot.mtf.alignmentPct}% aligned`
      : null,
    `Offense-Defense: ${commander.offenseDefenseAlignment}`,
    commander.ragAdjustment !== 0 ? `RAG adj: ${commander.ragAdjustment > 0 ? '+' : ''}${commander.ragAdjustment}` : null,
    `L1: ${orchestration.meta.level1SuccessCount}/${orchestration.meta.totalAgents} agents`,
  ].filter(Boolean).join(' · ');

  // Highlights from agent verdicts
  const highlights: ScanHighlight[] = verdicts.map((v) => ({
    agent: AGENT_META[v.agentId]?.name ?? v.agentId,
    vote: v.direction,
    conf: v.confidence,
    note: v.reasoning,
  }));

  return {
    pair: snapshot.pair,
    timeframe: snapshot.timeframe,
    token: snapshot.token,
    createdAt: now,
    label: timeLabel,
    signals,
    consensus,
    avgConfidence,
    summary,
    highlights,
  };
}
