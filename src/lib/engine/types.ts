// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Agent Engine v3 Core Types
// ═══════════════════════════════════════════════════════════════

// ─── Market Data (shared between client & server) ────────────

/** Binance OHLCV kline — canonical type used across engine, server, and client. */
export interface BinanceKline {
  time: number;       // Open time (seconds for LightweightCharts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Binance 24hr ticker — canonical type shared between client & server. */
export interface Binance24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

// ─── Agent Pool ──────────────────────────────────────────────

export const AGENT_IDS = [
  'STRUCTURE', 'VPA', 'ICT',       // OFFENSE
  'DERIV', 'VALUATION', 'FLOW',    // DEFENSE
  'SENTI', 'MACRO',                // CONTEXT
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export type AgentRole = 'OFFENSE' | 'DEFENSE' | 'CONTEXT';

export interface AgentDefinition {
  id: AgentId;
  name: string;
  nameKR: string;
  icon: string;
  color: string;
  role: AgentRole;
  description: string;
  descriptionKR: string;
  factors: FactorDefinition[];
  specs: SpecDefinition[];
}

// ─── Factor ──────────────────────────────────────────────────

export interface FactorDefinition {
  id: string;                   // e.g. 'EMA_TREND', 'RSI_DIVERGENCE'
  name: string;
  description: string;
}

export interface FactorResult {
  factorId: string;
  value: number;                // -100 ~ +100 (음수=bearish, 양수=bullish)
  rawValue?: number;            // 원시값 (RSI 58 등)
  trend?: TrendAnalysis;
  divergence?: DivergenceSignal;
  detail: string;
}

// ─── Spec ────────────────────────────────────────────────────

export type SpecTier = 'base' | 'a' | 'b' | 'c';

export interface SpecDefinition {
  id: string;                    // 'base', 'trend_rider', 'squeeze_hunter' ...
  name: string;
  nameKR: string;
  tier: SpecTier;                // 해금 단계
  unlockMatches: number;         // 0(base), 10(a/b), 30(c)
  description: string;
  descriptionKR: string;
  weakness: string;
  weights: Record<string, number>;  // factorId → weight (합계 1.0)
  llmPrompt?: string;            // Phase 6에서 추가
}

// ─── Trend Analysis ──────────────────────────────────────────

export type TrendDirection = 'RISING' | 'FALLING' | 'FLAT';

export interface TrendAnalysis {
  direction: TrendDirection;
  slope: number;                 // -1.0 ~ +1.0 정규화
  acceleration: number;          // 기울기의 변화율
  strength: number;              // 0-100
  duration: number;              // 현재 추세 유지 봉 수
  fromValue: number;
  toValue: number;
  changePct: number;
}

export type DivergenceType =
  | 'BULLISH_DIV'
  | 'BEARISH_DIV'
  | 'HIDDEN_BULL'
  | 'HIDDEN_BEAR'
  | 'NONE';

export interface DivergenceSignal {
  type: DivergenceType;
  indicator: string;
  priceAction: 'HH' | 'HL' | 'LH' | 'LL';
  indicatorAction: 'HH' | 'HL' | 'LH' | 'LL';
  confidence: number;            // 0-100
  detail: string;
}

export type MTFAlignment =
  | 'ALIGNED_BULL'
  | 'ALIGNED_BEAR'
  | 'CONFLICTING'
  | 'NEUTRAL';

export interface MultiTimeframeTrend {
  tf1h: TrendAnalysis;
  tf4h: TrendAnalysis;
  tf1d: TrendAnalysis;
  alignment: MTFAlignment;
}

// ─── Draft ───────────────────────────────────────────────────

export interface DraftSelection {
  agentId: AgentId;
  specId: string;
  weight: number;                // 0-100, 3개 합산 = 100
}

export interface DraftValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Agent Output ────────────────────────────────────────────

export type Direction = 'LONG' | 'SHORT' | 'NEUTRAL';

export interface AgentOutput {
  agentId: AgentId;
  specId: string;
  direction: Direction;
  confidence: number;            // 0-100
  thesis: string;                // LLM 또는 자동 생성
  factors: FactorResult[];
  bullScore: number;
  bearScore: number;
  memoryContext?: MemoryContext;
  trendContext?: Record<string, TrendAnalysis>;
  divergences?: DivergenceSignal[];
  latencyMs?: number;
}

export interface MemoryContext {
  totalSimilar: number;
  winRate: number;
  winPatterns: string[];
  lossPatterns: string[];
  suggestions: string[];
}

// ─── Match ───────────────────────────────────────────────────

export type MatchPhase = 'DRAFT' | 'ANALYSIS' | 'HYPOTHESIS' | 'BATTLE' | 'RESULT';

export type MarketRegime = 'trending_up' | 'trending_down' | 'ranging' | 'volatile';

export interface MatchPrediction {
  direction: Direction;
  confidence: number;
  isOverride: boolean;
  exitStrategy?: 'conservative' | 'balanced' | 'aggressive';
  slPrice?: number;
  tpPrice?: number;
  reasonTags?: string[];
}

export interface MatchState {
  id: string;
  pair: string;
  timeframe: string;
  phase: MatchPhase;
  userAId: string;
  userBId: string | null;          // null = AI
  userADraft: DraftSelection[] | null;
  userBDraft: DraftSelection[] | null;
  userAPrediction: MatchPrediction | null;
  userBPrediction: MatchPrediction | null;
  analysisResults: AgentOutput[];
  entryPrice: number | null;
  exitPrice: number | null;
  priceChange: number | null;
  marketRegime: MarketRegime | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

// ─── Scoring ─────────────────────────────────────────────────

export interface FBScore {
  ds: number;                    // Decision Score (0-100)
  re: number;                    // Risk/Execution (0-100)
  ci: number;                    // Confidence Index (0-100)
  fbs: number;                   // Final: 0.5*DS + 0.3*RE + 0.2*CI
}

export type MatchResultType = 'normal_win' | 'clutch_win' | 'draw';

export interface MatchResult {
  winnerId: string | null;       // null = draw
  resultType: MatchResultType;
  userAScore: FBScore;
  userBScore: FBScore;
  userALpDelta: number;
  userBLpDelta: number;
  agentBreakdown: {
    agentId: AgentId;
    specId: string;
    direction: Direction;
    correct: boolean;
  }[];
}

// ─── LP / Tier ───────────────────────────────────────────────

export type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'MASTER';

export interface TierInfo {
  tier: Tier;
  level: number;                 // 1, 2, 3 (Diamond I/II/III)
  lpMin: number;
  lpMax: number;
  features: string[];
}

export type LPReason =
  | 'normal_win' | 'clutch_win' | 'loss' | 'draw'
  | 'perfect_read' | 'dissent_win'
  | 'challenge_win' | 'challenge_loss'
  | 'streak_bonus';

export interface LPTransaction {
  id: string;
  userId: string;
  matchId: string | null;
  amount: number;
  reason: LPReason;
  balanceAfter: number;
  createdAt: string;
}

// ─── Passport ────────────────────────────────────────────────

export interface Passport {
  userId: string;
  displayName: string;
  passportNumber: number;

  // 6대 메트릭
  winRate: number;
  directionAccuracy: number;
  idsScore: number;
  calibration: number;
  guardianCompliance: number;
  challengeWinRate: number;

  // LP + Tier
  lpTotal: number;
  tier: Tier;
  tierLevel: number;

  // 연속
  currentStreak: number;
  bestWinStreak: number;
  worstLossStreak: number;

  // 에이전트 경험
  agentStats: PassportAgentStats[];

  // 배지
  badges: Badge[];

  // 원시 카운트
  totalHypotheses: number;
  winCount: number;
  lossCount: number;
}

export interface PassportAgentStats {
  agentId: AgentId;
  totalMatches: number;
  wins: number;
  winRate: number;
  unlockedSpecs: string[];
  mostUsedSpec: string;
  ragMemoryCount: number;
  bestComboWith: AgentId[];
  avgDraftWeight: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  category: 'season' | 'skill' | 'courage' | 'activity' | 'mastery' | 'consistency' | 'progression';
  earnedAt: string;
}

// ─── Exit Optimizer ──────────────────────────────────────────

export interface ExitLevel {
  sl: number;
  tp: number;
  rr: number;                    // Risk:Reward ratio
  tpProb: number;                // TP 도달 확률
  ev: number;                    // Expected Value
}

export interface ExitRecommendation {
  conservative: ExitLevel;
  balanced: ExitLevel;
  aggressive: ExitLevel;
  recommended: 'conservative' | 'balanced' | 'aggressive';
  kellySize: number;             // 최적 포지션 사이즈 %
}

// ─── RAG Memory ──────────────────────────────────────────────

export interface MatchMemory {
  id: string;
  userId: string;
  agentId: AgentId;
  specId: string;
  pair: string;
  matchId: string;

  marketState: Record<string, { value: number; trend?: TrendAnalysis }>;
  marketRegime: MarketRegime;

  direction: Direction;
  confidence: number;
  factors: FactorResult[];
  thesis: string;

  outcome: boolean;
  priceChange: number;
  lesson: string;

  embedding?: number[];          // 256d
  isActive: boolean;
  createdAt: string;
}

// ─── Challenge ───────────────────────────────────────────────

export interface Challenge {
  id: string;
  userId: string;
  agentId: AgentId;
  specId: string;
  pair: string;
  userDirection: Direction;
  agentDirection: Direction;
  reasonTags: string[];
  reasonText?: string;
  outcome: boolean | null;       // null = 미판정
  lpDelta: number | null;
  matchId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ─── LIVE ────────────────────────────────────────────────────

export type LiveStage =
  | 'WAITING'
  | 'HYPOTHESIS_SUBMITTED'
  | 'ANALYSIS_RUNNING'
  | 'POSITION_OPEN'
  | 'RESULT_SHOWN';

export interface LiveSession {
  id: string;
  matchId: string;
  creatorId: string;
  pair: string;
  direction?: Direction;
  confidence?: number;
  stage: LiveStage;
  spectatorCount: number;
  pnlCurrent?: number;
  isLive: boolean;
  createdAt: string;
  endedAt?: string;
}

export type LiveReaction = '🔥' | '🧊' | '🤔' | '⚡' | '💀';
