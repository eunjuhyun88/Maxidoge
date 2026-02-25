export type DecisionBias = 'long' | 'short' | 'wait';

export type EvidenceDomain =
  | 'headlines'
  | 'events'
  | 'flow'
  | 'derivatives'
  | 'trending'
  | 'positions';

export interface QualityGateScores {
  actionability: number; // Can this trigger a trade action?
  timeliness: number; // Is the signal still fresh for the target horizon?
  reliability: number; // Source and calculation trust level.
  relevance: number; // Pair/timeframe relevance.
}

export interface QualityGateResult {
  score: number;
  pass: boolean;
  blockers: string[];
}

export interface DecisionEvidence {
  domain: EvidenceDomain;
  bias: DecisionBias;
  biasStrength: number; // 0..100
  confidence: number; // 0..100
  freshnessSec: number;
  reason: string;
}

export interface IntelDecisionOutput {
  bias: DecisionBias;
  confidence: number; // 0..100
  shouldTrade: boolean;
  qualityGateScore: number;
  longScore: number;
  shortScore: number;
  netEdge: number;
  reasons: string[];
  blockers: string[];
}

const QUALITY_WEIGHTS = {
  actionability: 0.3,
  timeliness: 0.2,
  reliability: 0.3,
  relevance: 0.2,
} as const;

const QUALITY_MIN = {
  actionability: 65,
  timeliness: 60,
  reliability: 70,
  relevance: 70,
} as const;

const QUALITY_PASS_THRESHOLD = 70;

const EVIDENCE_WEIGHTS: Record<EvidenceDomain, number> = {
  derivatives: 0.28,
  flow: 0.22,
  events: 0.18,
  headlines: 0.14,
  positions: 0.1,
  trending: 0.08,
};

const MAX_SIGNAL_AGE_SEC: Record<EvidenceDomain, number> = {
  derivatives: 1800,
  flow: 2700,
  events: 21600,
  headlines: 5400,
  positions: 3600,
  trending: 7200,
};

const MIN_EDGE_TO_TRADE = 8;
const CONFLICT_PENALTY = 0.18;

function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function freshnessFactor(domain: EvidenceDomain, freshnessSec: number): number {
  const maxAge = MAX_SIGNAL_AGE_SEC[domain];
  const safeAge = Math.max(0, freshnessSec);
  if (safeAge >= maxAge) return 0;
  return 1 - safeAge / maxAge;
}

export function evaluateQualityGate(scores: QualityGateScores): QualityGateResult {
  const normalized = {
    actionability: clamp(scores.actionability),
    timeliness: clamp(scores.timeliness),
    reliability: clamp(scores.reliability),
    relevance: clamp(scores.relevance),
  };

  const score = round2(
    normalized.actionability * QUALITY_WEIGHTS.actionability +
      normalized.timeliness * QUALITY_WEIGHTS.timeliness +
      normalized.reliability * QUALITY_WEIGHTS.reliability +
      normalized.relevance * QUALITY_WEIGHTS.relevance,
  );

  const blockers: string[] = [];
  if (normalized.actionability < QUALITY_MIN.actionability) blockers.push('actionability_low');
  if (normalized.timeliness < QUALITY_MIN.timeliness) blockers.push('timeliness_low');
  if (normalized.reliability < QUALITY_MIN.reliability) blockers.push('reliability_low');
  if (normalized.relevance < QUALITY_MIN.relevance) blockers.push('relevance_low');

  const pass = blockers.length === 0 && score >= QUALITY_PASS_THRESHOLD;

  return { score, pass, blockers };
}

function evidenceContribution(evidence: DecisionEvidence): number {
  const biasSign = evidence.bias === 'long' ? 1 : evidence.bias === 'short' ? -1 : 0;
  const quality = clamp(evidence.biasStrength) / 100;
  const confidence = clamp(evidence.confidence) / 100;
  const freshness = freshnessFactor(evidence.domain, evidence.freshnessSec);
  const domainWeight = EVIDENCE_WEIGHTS[evidence.domain];
  return biasSign * quality * confidence * freshness * domainWeight * 100;
}

export function computeIntelDecision(
  gate: QualityGateResult,
  evidenceList: DecisionEvidence[],
): IntelDecisionOutput {
  if (!gate.pass) {
    return {
      bias: 'wait',
      confidence: Math.round(gate.score * 0.5),
      shouldTrade: false,
      qualityGateScore: gate.score,
      longScore: 0,
      shortScore: 0,
      netEdge: 0,
      reasons: [],
      blockers: gate.blockers,
    };
  }

  let longScore = 0;
  let shortScore = 0;
  let longCount = 0;
  let shortCount = 0;

  const byAbsContribution = evidenceList
    .map((e) => ({ evidence: e, contribution: evidenceContribution(e) }))
    .filter((row) => Number.isFinite(row.contribution) && row.contribution !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  for (const row of byAbsContribution) {
    if (row.contribution > 0) {
      longScore += row.contribution;
      longCount += 1;
    } else {
      shortScore += Math.abs(row.contribution);
      shortCount += 1;
    }
  }

  const conflictPenalty = longCount > 0 && shortCount > 0 ? CONFLICT_PENALTY : 0;
  longScore *= 1 - conflictPenalty;
  shortScore *= 1 - conflictPenalty;

  const netEdge = round2(longScore - shortScore);
  const absEdge = Math.abs(netEdge);

  let bias: DecisionBias = 'wait';
  if (netEdge >= MIN_EDGE_TO_TRADE) bias = 'long';
  else if (netEdge <= -MIN_EDGE_TO_TRADE) bias = 'short';

  const confidence = clamp(Math.round(absEdge * 0.7 + gate.score * 0.3));
  const shouldTrade = bias !== 'wait';

  return {
    bias,
    confidence,
    shouldTrade,
    qualityGateScore: gate.score,
    longScore: round2(longScore),
    shortScore: round2(shortScore),
    netEdge,
    reasons: byAbsContribution.slice(0, 3).map((row) => row.evidence.reason),
    blockers: shouldTrade ? [] : ['edge_below_threshold'],
  };
}
