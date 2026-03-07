// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Types
// ═══════════════════════════════════════════════════════════════
//
// 설계서: docs/specs/LLM_AGENT_SCAN_DESIGN.md
// 3-Level Architecture: 8 Analyst → 2 Synthesis → 1 Commander

import type { AgentId } from '$lib/engine/types';
import type { SRLevel } from '$lib/engine/supportResistance';

// ─── Vote (matches AgentSignal.vote) ────────────────────────

export type ScanVote = 'long' | 'short' | 'neutral';

// ─── MarketSnapshot — scanEngine Phase 1-3 data, structured ──

export interface MarketSnapshot {
  // ── Basic ──
  pair: string;
  timeframe: string;
  token: string;
  latestClose: number;
  timestamp: number;

  // ── Candle summary (pre-computed, not raw klines) ──
  candles: {
    rsi14: number | null;
    sma20: number | null;
    sma60: number | null;
    sma120: number | null;
    atrPct: number | null;
    volumeRatio: number;
    change24h: number;
    priceVsBollinger: 'above_upper' | 'upper_zone' | 'mid' | 'lower_zone' | 'below_lower';
    recentPattern: string | null;
    trendStructure: 'HH_HL' | 'LH_LL' | 'ranging';
  };

  // ── Derivatives ──
  derivatives: {
    openInterest: number | null;
    funding: number | null;
    predictedFunding: number | null;
    lsRatio: number | null;
    liqLong24h: number;
    liqShort24h: number;
    oiChangePercent: number | null;
  };

  // ── On-chain ──
  onchain: {
    exchangeNetflow: number | null;
    whaleNetflow: number | null;
    minerOutflow: number | null;
    mvrv: number | null;
    nupl: number | null;
    exchangeReserve: number | null;
    exchangeReserveChange7dPct: number | null;
  };

  // ── Sentiment ──
  sentiment: {
    fearGreedIndex: number | null;
    fearGreedLabel: string | null;
    socialSentiment: number | null;
    socialDominance: number | null;
    galaxyScore: number | null;
    socialInteractions24h: number | null;
  };

  // ── Macro ──
  macro: {
    dxy: { value: number; change1d: number; trend1m: number | null } | null;
    spx: { value: number; change1d: number; trend1m: number | null } | null;
    us10y: { value: number; change1d: number } | null;
    fedFundsRate: number | null;
    yieldCurve: number | null;
    m2ChangePercent: number | null;
    btcDominance: number | null;
    totalMarketCapChange24h: number | null;
  };

  // ── VPA (Volume Price Analysis) ──
  vpa: {
    cvdRatio: number;
    buyVolPercent: number;
    volumeRatio: number;
    absorptionCount: number;
  };

  // ── ICT (Smart Money Concepts) ──
  ict: {
    pricePosition50: number;
    bullFvgCount: number;
    bearFvgCount: number;
    recentHighBreak: boolean;
    recentLowBreak: boolean;
    range50High: number;
    range50Low: number;
  };

  // ── ETH specific (null if not ETH pair) ──
  ethOnchain: {
    gasStandard: number | null;
    activeAddresses: number | null;
    exchangeBalance: number | null;
    whaleActivity: number | null;
  } | null;

  // ── Multi-Timeframe Context (5 TF consensus) ──
  mtf: {
    consensusBias: 'long' | 'short' | 'neutral';
    consensusConfidence: number;
    alignmentPct: number;
    weightedScore: number;
    snapshots: Array<{
      timeframe: string;
      bias: 'long' | 'short' | 'neutral';
      confidence: number;
      emaTrend: 'bullish' | 'bearish' | 'flat';
      rsi14: number;
      macdState: 'bullish' | 'bearish' | 'flat';
      atrPct: number;
    }>;
  } | null;

  // ── Support/Resistance Levels (multi-TF merged) ──
  srLevels: SRLevel[];
}

// ─── Level 1: Analyst Agent Output ──────────────────────────

export interface AgentVerdict {
  agentId: AgentId;
  direction: ScanVote;
  confidence: number;    // 0-100
  reasoning: string;     // LLM 생성 한국어 텍스트
  // Agent-specific analysis fields (optional, for downstream)
  trendAssessment?: string;
  momentum?: string;
  reversalRisk?: string;
  crowding?: string;
  squeezePotential?: string;
  divergence?: string;
}

// ─── Level 2: Synthesis Agent Output ────────────────────────

export interface SynthesisResult {
  role: 'offense' | 'defense';
  direction: ScanVote;
  confidence: number;    // 0-100
  agreementLevel: 'strong' | 'moderate' | 'weak';
  keyFactor: string;
  reasoning: string;
}

// ─── Level 3: Commander Decision ────────────────────────────

export interface CommanderDecision {
  direction: ScanVote;
  confidence: number;    // 0-100
  entry: number;
  tp: number;
  sl: number;
  offenseDefenseAlignment: 'aligned' | 'conflicting' | 'one_side_neutral';
  ragAdjustment: number; // -20 ~ +20
  reasoning: string;     // 한국어 100자 이내
  keyRisks: string[];
}

// ─── RAG query result (for Commander) ───────────────────────

export interface RAGScanResult {
  similarCases: number;
  longWinRate: number;
  shortWinRate: number;
  avgConfidenceWhenCorrect: number;
  recentTrend: string;
  lesson: string;
}

// ─── Orchestration Error ────────────────────────────────────

export class LLMScanError extends Error {
  constructor(
    message: string,
    public readonly phase: 'snapshot' | 'analyst' | 'synthesis' | 'commander' | 'mapping',
    public readonly recoverable: boolean = true,
  ) {
    super(`[C-02:${phase}] ${message}`);
    this.name = 'LLMScanError';
  }
}
