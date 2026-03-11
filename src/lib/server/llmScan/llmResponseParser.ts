// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Response Parser
// ═══════════════════════════════════════════════════════════════
//
// Robust JSON extraction from LLM responses.
// Handles: raw JSON, markdown fences, partial JSON, missing fields.

import type { AgentId } from '$lib/engine/types';
import type { AgentVerdict, CommanderDecision, ScanVote, SynthesisResult } from './types';
import { clamp } from '$lib/utils/math';

// ─── JSON Extraction ────────────────────────────────────────

/**
 * Extract JSON object from LLM text response.
 * Handles:
 * - Raw JSON: { ... }
 * - Markdown fence: ```json\n{ ... }\n```
 * - Leading/trailing text around JSON
 */
function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();

  // 1. Try markdown fence extraction
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?\s*(\{[\s\S]*?\})\s*\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]) as Record<string, unknown>;
    } catch { /* fall through */ }
  }

  // 2. Try raw JSON (find first { ... last })
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch { /* fall through */ }
  }

  // 3. Try whole string
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>;
  } catch { /* fall through */ }

  return null;
}

// ─── Field Helpers ──────────────────────────────────────────

function parseVote(value: unknown): ScanVote {
  if (value === 'long' || value === 'short' || value === 'neutral') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'long' || lower === 'bullish') return 'long';
    if (lower === 'short' || lower === 'bearish') return 'short';
  }
  return 'neutral';
}

function parseConfidence(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.round(clamp(n, 0, 100));
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

// ─── Level 1: Agent Verdict Parser ──────────────────────────

export function parseAgentVerdict(raw: string, agentId: AgentId): AgentVerdict | null {
  const json = extractJson(raw);
  if (!json) return null;

  const direction = parseVote(json.direction);
  const confidence = parseConfidence(json.confidence);
  const reasoning = parseString(json.reasoning, '분석 완료');

  return {
    agentId,
    direction,
    confidence,
    reasoning,
    trendAssessment: parseString(json.trend_assessment ?? json.trendAssessment, undefined as unknown as string) || undefined,
    momentum: parseString(json.momentum, undefined as unknown as string) || undefined,
    reversalRisk: parseString(json.reversal_risk ?? json.reversalRisk, undefined as unknown as string) || undefined,
    crowding: parseString(json.crowding, undefined as unknown as string) || undefined,
    squeezePotential: parseString(json.squeeze_potential ?? json.squeezePotential, undefined as unknown as string) || undefined,
    divergence: parseString(json.divergence, undefined as unknown as string) || undefined,
  };
}

// ─── Level 2: Synthesis Result Parser ───────────────────────

export function parseSynthesisResult(raw: string, role: 'offense' | 'defense'): SynthesisResult | null {
  const json = extractJson(raw);
  if (!json) return null;

  const agreementRaw = parseString(json.agreement_level ?? json.agreementLevel, 'moderate');
  const agreementLevel = (['strong', 'moderate', 'weak'] as const).includes(agreementRaw as 'strong')
    ? (agreementRaw as 'strong' | 'moderate' | 'weak')
    : 'moderate';

  return {
    role,
    direction: parseVote(json.direction),
    confidence: parseConfidence(json.confidence),
    agreementLevel,
    keyFactor: parseString(json.key_factor ?? json.keyFactor, '종합 판단'),
    reasoning: parseString(json.reasoning, '종합 완료'),
  };
}

// ─── Level 3: Commander Decision Parser ─────────────────────

export function parseCommanderDecision(raw: string, fallbackEntry: number, fallbackAtrPct: number | null): CommanderDecision | null {
  const json = extractJson(raw);
  if (!json) return null;

  const direction = parseVote(json.direction);
  const confidence = parseConfidence(json.confidence);

  // TP/SL: use LLM values if present, otherwise compute from ATR
  let entry = parseNumber(json.entry, fallbackEntry);
  let tp = parseNumber(json.tp, 0);
  let sl = parseNumber(json.sl, 0);

  // Sanity check: if TP/SL are wildly off, recalculate
  if (entry <= 0) entry = fallbackEntry;
  if (tp <= 0 || sl <= 0) {
    const atr = fallbackAtrPct != null ? (fallbackAtrPct / 100) * entry : entry * 0.008;
    const risk = Math.max(atr * 0.9, entry * 0.0035);
    if (direction === 'long' || direction === 'neutral') {
      tp = entry + risk * 1.8;
      sl = entry - risk;
    } else {
      tp = entry - risk * 1.8;
      sl = entry + risk;
    }
  }

  const alignmentRaw = parseString(
    json.offense_defense_alignment ?? json.offenseDefenseAlignment,
    'aligned',
  );
  const alignment = (['aligned', 'conflicting', 'one_side_neutral'] as const).includes(alignmentRaw as 'aligned')
    ? (alignmentRaw as 'aligned' | 'conflicting' | 'one_side_neutral')
    : 'aligned';

  return {
    direction,
    confidence,
    entry: roundPrice(entry),
    tp: roundPrice(tp),
    sl: roundPrice(sl),
    offenseDefenseAlignment: alignment,
    ragAdjustment: Math.round(clamp(parseNumber(json.rag_adjustment ?? json.ragAdjustment, 0), -20, 20)),
    reasoning: parseString(json.reasoning, '판정 완료'),
    keyRisks: parseStringArray(json.key_risks ?? json.keyRisks),
  };
}

// ─── Price rounding helper (matches scanEngine.ts) ──────────

function roundPrice(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 1000) return Math.round(value);
  if (Math.abs(value) >= 100) return Number(value.toFixed(2));
  return Number(value.toFixed(4));
}
