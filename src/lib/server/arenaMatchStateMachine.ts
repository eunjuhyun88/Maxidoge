// ═══════════════════════════════════════════════════════════════
// Stockclaw — Arena Match State Machine (B-01)
// Server-authoritative phase transitions with timeout enforcement
// ═══════════════════════════════════════════════════════════════

import { query } from '$lib/server/db';
import type { MatchPhase, PhaseTransitionResult } from '$lib/engine/types';
import {
  DRAFT_DURATION_SEC,
  HYPOTHESIS_DURATION_SEC,
  BATTLE_DURATION_SEC,
  ANALYSIS_TIMEOUT_MS,
} from '$lib/engine/constants';

// ── Phase Transition Rules ──────────────────────────────────

interface PhaseRule {
  from: MatchPhase;
  to: MatchPhase;
  trigger: string;
  timeoutSec: number | null;  // null = no auto-advance
}

const PHASE_RULES: PhaseRule[] = [
  { from: 'DRAFT',      to: 'ANALYSIS',   trigger: 'draft_submitted',      timeoutSec: DRAFT_DURATION_SEC },
  { from: 'ANALYSIS',   to: 'HYPOTHESIS',  trigger: 'analysis_complete',    timeoutSec: Math.ceil(ANALYSIS_TIMEOUT_MS / 1000) },
  { from: 'HYPOTHESIS', to: 'BATTLE',      trigger: 'hypothesis_submitted', timeoutSec: HYPOTHESIS_DURATION_SEC },
  { from: 'BATTLE',     to: 'RESULT',      trigger: 'battle_complete',      timeoutSec: null },  // 24h max, resolved by price
];

const VALID_TRANSITIONS = new Map<MatchPhase, MatchPhase>(
  PHASE_RULES.map(r => [r.from, r.to])
);

// ── DB error helper (same pattern as arenaService) ──────────

const TABLE_UNAVAILABLE = new Set(['42P01', '42703', '23503']);
function isTableError(err: unknown): boolean {
  const errObj = err as Record<string, unknown> | null | undefined;
  const code = typeof errObj?.code === 'string' ? errObj.code : '';
  return TABLE_UNAVAILABLE.has(code) || (typeof errObj?.message === 'string' && (errObj.message as string).includes('DATABASE_URL is not set'));
}

// ── Validate Transition ──────────────────────────────────────

export function validateTransition(
  currentPhase: MatchPhase,
  targetPhase: MatchPhase,
  matchData?: {
    userADraft?: unknown;
    analysisResults?: unknown[];
    userAPrediction?: unknown;
  },
): PhaseTransitionResult {
  const errors: string[] = [];

  // Check valid transition
  const expectedNext = VALID_TRANSITIONS.get(currentPhase);
  if (!expectedNext) {
    errors.push(`Phase ${currentPhase} is terminal — no further transitions allowed`);
    return { valid: false, errors };
  }
  if (expectedNext !== targetPhase) {
    errors.push(`Cannot transition from ${currentPhase} to ${targetPhase} — expected ${expectedNext}`);
    return { valid: false, errors };
  }

  // Check prerequisites
  if (targetPhase === 'ANALYSIS' && matchData && !matchData.userADraft) {
    errors.push('Draft must be submitted before ANALYSIS phase');
  }
  if (targetPhase === 'HYPOTHESIS' && matchData && (!matchData.analysisResults || matchData.analysisResults.length === 0)) {
    errors.push('Analysis results required before HYPOTHESIS phase');
  }
  if (targetPhase === 'BATTLE' && matchData && !matchData.userAPrediction) {
    errors.push('Hypothesis must be submitted before BATTLE phase');
  }

  if (errors.length > 0) return { valid: false, errors };

  // Calculate expiration
  const rule = PHASE_RULES.find(r => r.to === targetPhase);
  const expiresAt = rule?.timeoutSec
    ? new Date(Date.now() + rule.timeoutSec * 1000).toISOString()
    : undefined;

  return {
    valid: true,
    errors: [],
    phase: targetPhase,
    expiresAt,
  };
}

// ── Advance Phase (DB update) ────────────────────────────────

export async function advancePhase(
  matchId: string,
  userId: string,
  targetPhase: MatchPhase,
): Promise<PhaseTransitionResult> {
  // 1. Fetch current match state
  let currentPhase: MatchPhase | null = null;
  let matchData: { userADraft?: unknown; analysisResults?: unknown[]; userAPrediction?: unknown } = {};

  try {
    const res = await query<{
      phase: MatchPhase;
      user_a_draft: unknown;
      analysis_results: unknown[];
      user_a_prediction: unknown;
      user_a_id: string;
    }>(
      `SELECT phase, user_a_draft, analysis_results, user_a_prediction, user_a_id
       FROM arena_matches WHERE id = $1 LIMIT 1`,
      [matchId]
    );

    if (!res.rows[0]) {
      return { valid: false, errors: ['Match not found'] };
    }

    const row = res.rows[0];

    // Auth check
    if (row.user_a_id !== userId) {
      return { valid: false, errors: ['Not authorized for this match'] };
    }

    currentPhase = row.phase;
    matchData = {
      userADraft: row.user_a_draft,
      analysisResults: row.analysis_results,
      userAPrediction: row.user_a_prediction,
    };
  } catch (err: unknown) {
    if (isTableError(err)) {
      return { valid: false, errors: ['Database unavailable'] };
    }
    throw err;
  }

  if (!currentPhase) {
    return { valid: false, errors: ['Match has no phase'] };
  }

  // 2. Validate transition
  const validation = validateTransition(currentPhase, targetPhase, matchData);
  if (!validation.valid) return validation;

  // 3. Apply transition
  try {
    await query(
      `UPDATE arena_matches
       SET phase = $1
       WHERE id = $2 AND user_a_id = $3`,
      [targetPhase, matchId, userId]
    );
  } catch (err: unknown) {
    if (!isTableError(err)) throw err;
  }

  return validation;
}

// ── Get Phase Timer Info ──────────────────────────────────────

export function getPhaseTimerSec(phase: MatchPhase): number | null {
  const rule = PHASE_RULES.find(r => r.from === phase);
  return rule?.timeoutSec ?? null;
}

// ── Get Next Phase ───────────────────────────────────────────

export function getNextPhase(phase: MatchPhase): MatchPhase | null {
  return VALID_TRANSITIONS.get(phase) ?? null;
}

// ── Phase Metadata for Client ────────────────────────────────

export interface PhaseMetadata {
  phase: MatchPhase;
  timeoutSec: number | null;
  trigger: string;
  nextPhase: MatchPhase | null;
}

export function getPhaseMetadata(phase: MatchPhase): PhaseMetadata {
  const rule = PHASE_RULES.find(r => r.from === phase);
  return {
    phase,
    timeoutSec: rule?.timeoutSec ?? null,
    trigger: rule?.trigger ?? 'none',
    nextPhase: VALID_TRANSITIONS.get(phase) ?? null,
  };
}
