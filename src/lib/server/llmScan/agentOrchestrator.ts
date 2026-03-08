// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Agent Orchestrator
// ═══════════════════════════════════════════════════════════════
//
// 3-level parallel orchestration:
//   Level 1: 8 analyst agents (병렬)
//   Level 2: 2 synthesis agents (병렬)
//   Level 3: 1 commander (직렬)
//
// Uses existing callLLM() with Groq→Gemini→DeepSeek fallback.

import { AGENT_IDS, type AgentId } from '$lib/engine/types';
import { callLLM } from '$lib/server/llmService';
import type { AgentVerdict, CommanderDecision, LLMScanError, MarketSnapshot, RAGScanResult, SynthesisResult } from './types';
import { getLLMScanConfig } from './config';
import { buildAnalystMessages, buildCommanderMessages, buildSynthesisMessages } from './promptTemplates';
import { parseAgentVerdict, parseCommanderDecision, parseSynthesisResult } from './llmResponseParser';

// ─── Level 1: Analyst Agents ────────────────────────────────

const OFFENSE_AGENTS: AgentId[] = ['STRUCTURE', 'VPA', 'ICT'];
const DEFENSE_AGENTS: AgentId[] = ['DERIV', 'FLOW', 'SENTI', 'MACRO', 'VALUATION'];

/**
 * Run a single analyst agent LLM call.
 * Returns null on failure (caller handles fallback).
 */
async function runAnalystAgent(
  agentId: AgentId,
  snapshot: MarketSnapshot,
): Promise<AgentVerdict | null> {
  const config = getLLMScanConfig();

  try {
    const messages = buildAnalystMessages(agentId, snapshot);
    const result = await callLLM({
      messages,
      maxTokens: config.maxTokens.analyst,
      temperature: config.temperature.analyst,
      timeoutMs: config.llmCallTimeoutMs,
    });

    const verdict = parseAgentVerdict(result.text, agentId);
    if (!verdict) {
      console.warn(`[C-02:L1] ${agentId} — parse failure, raw: ${result.text.slice(0, 200)}`);
      return null;
    }

    return verdict;
  } catch (error) {
    console.warn(`[C-02:L1] ${agentId} — LLM call failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Create a fallback verdict for a failed agent.
 */
function createFallbackVerdict(agentId: AgentId): AgentVerdict {
  return {
    agentId,
    direction: 'neutral',
    confidence: 50,
    reasoning: 'LLM 응답 실패 — 중립 대체',
  };
}

/**
 * Run all 8 analyst agents in parallel.
 * Returns verdicts array (8 items, some may be fallback).
 * Throws LLMScanError if fewer than minSuccessful agents succeed.
 */
export async function runLevel1Analysts(
  snapshot: MarketSnapshot,
): Promise<{ verdicts: AgentVerdict[]; successCount: number }> {
  const config = getLLMScanConfig();

  const results = await Promise.allSettled(
    AGENT_IDS.map((id) => runAnalystAgent(id, snapshot)),
  );

  const verdicts: AgentVerdict[] = [];
  let successCount = 0;

  for (let i = 0; i < AGENT_IDS.length; i++) {
    const agentId = AGENT_IDS[i];
    const result = results[i];

    if (result.status === 'fulfilled' && result.value) {
      verdicts.push(result.value);
      successCount++;
    } else {
      verdicts.push(createFallbackVerdict(agentId));
    }
  }

  if (successCount < config.minSuccessfulAgents) {
    const err = new Error(
      `[C-02:L1] Only ${successCount}/${AGENT_IDS.length} agents succeeded (min: ${config.minSuccessfulAgents})\n수정: LLM 서비스 상태 확인 또는 minSuccessfulAgents 조정`,
    ) as Error & { phase: string; recoverable: boolean };
    err.phase = 'analyst';
    err.recoverable = true;
    throw err;
  }

  return { verdicts, successCount };
}

// ─── Level 2: Synthesis Agents ──────────────────────────────

/**
 * Run offense or defense synthesis agent.
 */
async function runSynthesisAgent(
  role: 'offense' | 'defense',
  verdicts: AgentVerdict[],
  snapshot: MarketSnapshot,
): Promise<SynthesisResult | null> {
  const config = getLLMScanConfig();

  try {
    const messages = buildSynthesisMessages(role, verdicts, snapshot);
    const result = await callLLM({
      messages,
      maxTokens: config.maxTokens.synthesis,
      temperature: config.temperature.synthesis,
      timeoutMs: config.llmCallTimeoutMs,
    });

    const parsed = parseSynthesisResult(result.text, role);
    if (!parsed) {
      console.warn(`[C-02:L2] ${role} — parse failure, raw: ${result.text.slice(0, 200)}`);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn(`[C-02:L2] ${role} — LLM call failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Create fallback synthesis from raw verdicts (majority vote).
 */
function createFallbackSynthesis(
  role: 'offense' | 'defense',
  verdicts: AgentVerdict[],
): SynthesisResult {
  const counts = { long: 0, short: 0, neutral: 0 };
  let totalConf = 0;

  for (const v of verdicts) {
    counts[v.direction]++;
    totalConf += v.confidence;
  }

  const direction = counts.long > counts.short && counts.long > counts.neutral
    ? 'long' as const
    : counts.short > counts.long && counts.short > counts.neutral
      ? 'short' as const
      : 'neutral' as const;

  return {
    role,
    direction,
    confidence: Math.round(totalConf / Math.max(verdicts.length, 1)),
    agreementLevel: 'moderate',
    keyFactor: '다수결 판단 (LLM 종합 실패)',
    reasoning: '에이전트 투표 기반 대체 판단',
  };
}

/**
 * Run Level 2 synthesis — offense and defense in parallel.
 */
export async function runLevel2Synthesis(
  verdicts: AgentVerdict[],
  snapshot: MarketSnapshot,
): Promise<{ offense: SynthesisResult; defense: SynthesisResult }> {
  const offenseVerdicts = verdicts.filter((v) => OFFENSE_AGENTS.includes(v.agentId));
  const defenseVerdicts = verdicts.filter((v) => DEFENSE_AGENTS.includes(v.agentId));

  const [offenseResult, defenseResult] = await Promise.allSettled([
    runSynthesisAgent('offense', offenseVerdicts, snapshot),
    runSynthesisAgent('defense', defenseVerdicts, snapshot),
  ]);

  const offense =
    offenseResult.status === 'fulfilled' && offenseResult.value
      ? offenseResult.value
      : createFallbackSynthesis('offense', offenseVerdicts);

  const defense =
    defenseResult.status === 'fulfilled' && defenseResult.value
      ? defenseResult.value
      : createFallbackSynthesis('defense', defenseVerdicts);

  return { offense, defense };
}

// ─── Level 3: Commander ─────────────────────────────────────

/**
 * Run the Commander — final decision.
 */
export async function runLevel3Commander(
  offense: SynthesisResult,
  defense: SynthesisResult,
  rag: RAGScanResult | null,
  snapshot: MarketSnapshot,
): Promise<CommanderDecision> {
  const config = getLLMScanConfig();

  try {
    const messages = buildCommanderMessages(offense, defense, rag, snapshot);
    const result = await callLLM({
      messages,
      maxTokens: config.maxTokens.commander,
      temperature: config.temperature.commander,
      timeoutMs: config.llmCallTimeoutMs + 2_000, // Commander gets extra time
    });

    const parsed = parseCommanderDecision(
      result.text,
      snapshot.latestClose,
      snapshot.candles.atrPct,
    );
    if (!parsed) {
      console.warn(`[C-02:L3] Commander — parse failure, raw: ${result.text.slice(0, 200)}`);
      return createFallbackCommander(offense, defense, snapshot);
    }

    return parsed;
  } catch (error) {
    console.warn(`[C-02:L3] Commander — LLM call failed:`, error instanceof Error ? error.message : error);
    return createFallbackCommander(offense, defense, snapshot);
  }
}

/**
 * Fallback commander: uses offense/defense synthesis to decide.
 */
function createFallbackCommander(
  offense: SynthesisResult,
  defense: SynthesisResult,
  snapshot: MarketSnapshot,
): CommanderDecision {
  // If both agree, use their direction; if conflicting, go neutral
  const aligned = offense.direction === defense.direction;
  const direction = aligned ? offense.direction : 'neutral';
  const confidence = aligned
    ? Math.round((offense.confidence + defense.confidence) / 2)
    : Math.round(Math.min(offense.confidence, defense.confidence) * 0.7);

  const atrPct = snapshot.candles.atrPct ?? 2;
  const risk = (atrPct / 100) * snapshot.latestClose * 0.9;
  const clampedRisk = Math.max(risk, snapshot.latestClose * 0.0035);

  const entry = snapshot.latestClose;
  const rr = 1.8;
  const isLong = direction === 'long' || (direction === 'neutral' && offense.confidence >= defense.confidence);

  return {
    direction,
    confidence,
    entry: roundPrice(entry),
    tp: roundPrice(isLong ? entry + clampedRisk * rr : entry - clampedRisk * rr),
    sl: roundPrice(isLong ? entry - clampedRisk : entry + clampedRisk),
    offenseDefenseAlignment: aligned ? 'aligned' : 'conflicting',
    ragAdjustment: 0,
    reasoning: 'Commander LLM 실패 — Offense/Defense 종합 기반 대체 판단',
    keyRisks: ['LLM 호출 실패로 인한 대체 판단'],
  };
}

function roundPrice(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 1000) return Math.round(value);
  if (Math.abs(value) >= 100) return Number(value.toFixed(2));
  return Number(value.toFixed(4));
}

// ═══════════════════════════════════════════════════════════════
// Full Pipeline
// ═══════════════════════════════════════════════════════════════

export interface OrchestratorResult {
  verdicts: AgentVerdict[];
  offense: SynthesisResult;
  defense: SynthesisResult;
  commander: CommanderDecision;
  meta: {
    level1SuccessCount: number;
    totalAgents: number;
  };
}

/**
 * Run the full 3-level orchestration pipeline.
 * Throws if Level 1 fails below minimum threshold.
 * Level 2 and 3 always produce results (with fallback).
 */
export async function runOrchestration(
  snapshot: MarketSnapshot,
  rag: RAGScanResult | null,
): Promise<OrchestratorResult> {
  // Level 1: 8 agents in parallel
  const { verdicts, successCount } = await runLevel1Analysts(snapshot);

  // Level 2: offense + defense synthesis in parallel
  const { offense, defense } = await runLevel2Synthesis(verdicts, snapshot);

  // Level 3: commander
  const commander = await runLevel3Commander(offense, defense, rag, snapshot);

  return {
    verdicts,
    offense,
    defense,
    commander,
    meta: {
      level1SuccessCount: successCount,
      totalAgents: AGENT_IDS.length,
    },
  };
}
