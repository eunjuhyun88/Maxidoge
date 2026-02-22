// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Arena API Client (browser-side)
// ═══════════════════════════════════════════════════════════════
//
// Wraps /api/arena/* endpoints for the Arena page to call.
// All functions return typed results or throw on error.

import type {
  Direction,
  DraftSelection,
  MatchPrediction,
  MatchState,
  MatchResult,
  AgentOutput,
  ExitRecommendation,
  MarketRegime,
} from '$lib/engine/types';

// ─── Response Types ─────────────────────────────────────────

export interface CreateMatchResponse {
  success: boolean;
  matchId: string;
  state: Partial<MatchState>;
}

export interface ListMatchesResponse {
  success: boolean;
  total: number;
  records: Partial<MatchState>[];
  pagination: { limit: number; offset: number };
}

export interface SubmitDraftResponse {
  success: boolean;
  phase: string;
  errors?: string[];
}

export interface AnalyzeResponse {
  success: boolean;
  agentOutputs: Pick<AgentOutput, 'agentId' | 'specId' | 'direction' | 'confidence' | 'thesis' | 'bullScore' | 'bearScore'>[];
  prediction: MatchPrediction;
  exitRecommendation: ExitRecommendation;
  entryPrice: number;
  regime: MarketRegime;
  meta: {
    totalLatencyMs: number;
    factorsComputed: number;
    factorsAvailable: number;
    dataCompleteness: number;
  };
}

export interface SubmitHypothesisResponse {
  success: boolean;
  prediction: MatchPrediction;
  phase: string;
}

export interface ResolveResponse {
  success: boolean;
  result: MatchResult;
  priceChange: string;
}

// ─── Helper ─────────────────────────────────────────────────

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.errors?.join(', ') || `API error ${res.status}`);
  }
  return data as T;
}

// ─── Arena API Functions ────────────────────────────────────

/** Create a new arena match */
export async function createArenaMatch(
  pair = 'BTC/USDT',
  timeframe = '4h',
): Promise<CreateMatchResponse> {
  return apiCall<CreateMatchResponse>('/api/arena/match', {
    method: 'POST',
    body: JSON.stringify({ pair, timeframe }),
  });
}

/** List user's arena matches */
export async function listArenaMatches(
  limit = 20,
  offset = 0,
): Promise<ListMatchesResponse> {
  return apiCall<ListMatchesResponse>(`/api/arena/match?limit=${limit}&offset=${offset}`);
}

/** Get a single match by ID */
export async function getArenaMatch(matchId: string): Promise<{ success: boolean; match: Partial<MatchState> }> {
  return apiCall(`/api/arena/match/${matchId}`);
}

/** Submit agent draft for a match */
export async function submitArenaDraft(
  matchId: string,
  draft: DraftSelection[],
): Promise<SubmitDraftResponse> {
  return apiCall<SubmitDraftResponse>('/api/arena/draft', {
    method: 'POST',
    body: JSON.stringify({ matchId, draft }),
  });
}

/** Run analysis pipeline (agents + exitOptimizer) */
export async function runArenaAnalysis(matchId: string): Promise<AnalyzeResponse> {
  return apiCall<AnalyzeResponse>('/api/arena/analyze', {
    method: 'POST',
    body: JSON.stringify({ matchId }),
  });
}

/** Submit user hypothesis (direction + confidence) */
export async function submitArenaHypothesis(
  matchId: string,
  direction: Direction,
  confidence: number,
  exitStrategy: 'conservative' | 'balanced' | 'aggressive' = 'balanced',
): Promise<SubmitHypothesisResponse> {
  return apiCall<SubmitHypothesisResponse>('/api/arena/hypothesis', {
    method: 'POST',
    body: JSON.stringify({ matchId, direction, confidence, exitStrategy }),
  });
}

/** Resolve match with exit price */
export async function resolveArenaMatch(
  matchId: string,
  exitPrice: number,
): Promise<ResolveResponse> {
  return apiCall<ResolveResponse>('/api/arena/resolve', {
    method: 'POST',
    body: JSON.stringify({ matchId, exitPrice }),
  });
}
