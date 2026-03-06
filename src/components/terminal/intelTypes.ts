// ═══ IntelPanel Types, Interfaces & Constants ═══
// Extracted from IntelPanel.svelte for reuse and testability

import type { Headline } from '$lib/data/warroom';

// ─── Feed & Chat Types ──────────────────────────────────────

export type FeedFilter = 'all' | 'news' | 'events' | 'flow' | 'trending' | 'community';

export type ScanHighlight = {
  agent: string;
  vote: 'long' | 'short' | 'neutral';
  conf: number;
  note: string;
};

export type ScanBrief = {
  pair: string;
  timeframe: string;
  token: string;
  createdAt: number;
  label: string;
  consensus: 'long' | 'short' | 'neutral';
  avgConfidence: number;
  summary: string;
  highlights: ScanHighlight[];
};

// ─── Position Types ─────────────────────────────────────────

export type PositionTradeRow = {
  id: string;
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  pnlPercent: number;
  demo?: boolean;
};

export type PositionMarketRow = {
  id: string;
  asset: string;
  direction: string;
  amountUsdc: number | null;
  pnlPercent: number;
  pnlUsdc: number | null;
  status: string;
  meta: Record<string, unknown>;
  demo?: boolean;
};

// ─── Live Data Types ────────────────────────────────────────

export interface HeadlineEx extends Headline {
  interactions?: number;
  importance?: number;
  network?: string;
  creator?: string;
}

export interface OnchainData {
  mvrv: { value: number | null; zone: string | null; nupl: number | null };
  whale: { count: number; netflow: number; ratio: number };
  liquidation: { longTotal1h: number; shortTotal1h: number; total1h: number; dominance: string };
  exchangeFlow: { netflow24h: number | null; direction: string };
  alerts: Array<{ id: string; category: string; severity: string; title: string; body: string }>;
  fetchedAt: number;
}

// ─── Trending Types ─────────────────────────────────────────

export interface TrendingCoin {
  rank: number; symbol: string; name: string; price: number;
  change1h: number; change24h: number; change7d: number; volume24h: number;
  sentiment?: number | null; socialVolume?: number | null; galaxyScore?: number | null;
}

export interface GainerLoser extends TrendingCoin {
  direction: 'gainer' | 'loser';
}

export type TrendTab = 'hot' | 'gainers' | 'dex' | 'picks';

export interface DexHot {
  chainId: string;
  tokenAddress: string;
  url: string;
  description: string | null;
  icon: string | null;
  source: 'boost' | 'profile';
  symbol?: string | null;
  name?: string | null;
  priceUsd?: number | null;
  change24h?: number | null;
  volume24h?: number | null;
  liquidityUsd?: number | null;
}

// ─── Opportunity Scanner Types ──────────────────────────────

export interface OpScore {
  symbol: string; name: string; price: number;
  change1h: number; change24h: number; change7d: number;
  volume24h: number; marketCap: number;
  momentumScore: number; volumeScore: number; socialScore: number;
  macroScore: number; onchainScore: number; totalScore: number;
  direction: 'long' | 'short' | 'neutral'; confidence: number;
  reasons: string[]; alerts: string[];
  sentiment?: number | null; galaxyScore?: number | null;
}

export interface OpAlert {
  symbol: string; type: string; severity: string; message: string; score: number;
}

// ─── Intel Policy Types ─────────────────────────────────────

export type PolicyPanel = 'headlines' | 'events' | 'flow' | 'trending' | 'picks';

export interface PolicyScores {
  actionability: number;
  timeliness: number;
  reliability: number;
  relevance: number;
  helpfulness: number;
}

export interface PolicyGate {
  weightedScore: number;
  pass: boolean;
  visibility: 'full' | 'low_impact' | 'hidden';
  blockers: string[];
  scores: PolicyScores;
}

export interface PolicyCard {
  id: string;
  panel: PolicyPanel;
  title: string;
  source: string;
  createdAt: number;
  bias: 'long' | 'short' | 'wait';
  confidence: number;
  what: string;
  soWhat: string;
  nowWhat: string;
  why: string;
  helpfulnessWhy: string;
  visualAid: string | null;
  gate: PolicyGate;
}

export interface PolicyDecision {
  bias: 'long' | 'short' | 'wait';
  confidence: number;
  edgePct: number;
  qualityGateScore: number;
  coveragePct: number;
  reasons: string[];
  blockers: string[];
  shouldTrade: boolean;
}

export interface ShadowProposal {
  bias: 'long' | 'short' | 'wait';
  confidence: number;
  horizonMin: number;
  rationale: string[];
  risks: string[];
  nowWhat: string;
}

export interface ShadowEnforcedDecision {
  bias: 'long' | 'short' | 'wait';
  wouldTrade: boolean;
  shouldExecute: boolean;
  reasons: string[];
}

export interface ShadowDecision {
  mode: 'shadow';
  generatedAt: number;
  source: 'llm' | 'fallback';
  fallbackReason: 'provider_unavailable' | 'llm_call_failed' | null;
  provider: string | null;
  model: string | null;
  proposal: ShadowProposal;
  enforced: ShadowEnforcedDecision;
}

export interface ShadowRuntime {
  available: boolean;
  providers: string[];
  preferred: string | null;
}

// ─── Constants ──────────────────────────────────────────────

export const POSITIONS_MIN_REFRESH_MS = 8_000;
export const POSITIONS_PENDING_POLL_MS = 6_000;
export const POSITIONS_FULL_REFRESH_MS = 30_000;

export const DEMO_QUICK_TRADES: PositionTradeRow[] = [
  { id: 'demo-trade-btc', pair: 'BTC/USDT', dir: 'LONG', entry: 103450, pnlPercent: 1.8, demo: true },
  { id: 'demo-trade-sol', pair: 'SOL/USDT', dir: 'SHORT', entry: 184.2, pnlPercent: -0.7, demo: true },
];

export const DEMO_GMX_POSITIONS: PositionMarketRow[] = [
  {
    id: 'demo-gmx-eth',
    asset: 'ETH',
    direction: 'LONG',
    amountUsdc: 600,
    pnlPercent: 2.34,
    pnlUsdc: 14.04,
    status: 'open',
    meta: { leverage: 5 },
    demo: true,
  },
];

export const DEMO_POLYMARKET_POSITIONS: PositionMarketRow[] = [
  {
    id: 'demo-poly-1',
    asset: 'BTC closes above $105k this week?',
    direction: 'YES',
    amountUsdc: 120,
    pnlPercent: 6.1,
    pnlUsdc: 7.32,
    status: 'filled',
    meta: {},
    demo: true,
  },
];

export const MVRV_ZONE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  deep_value:    { label: 'Deep Value',    emoji: '🟣', color: '#a855f7' },
  undervalued:   { label: 'Undervalued',   emoji: '🔵', color: '#3b82f6' },
  fair_value:    { label: 'Fair Value',    emoji: '🟢', color: '#22c55e' },
  optimism:      { label: 'Optimism',      emoji: '🟡', color: '#eab308' },
  greed:         { label: 'Greed',         emoji: '🟠', color: '#f97316' },
  extreme_greed: { label: 'Extreme Greed', emoji: '🔴', color: '#ef4444' },
};

export const FEED_FILTER_OPTIONS_ALL: Array<{ key: FeedFilter; label: string }> = [
  { key: 'all', label: 'ALL' },
  { key: 'flow', label: 'FLOW' },
  { key: 'events', label: 'EVENTS' },
  { key: 'trending', label: 'TRENDING' },
  { key: 'news', label: 'NEWS' },
  { key: 'community', label: 'COMMUNITY' },
];

export const FEED_FILTER_OPTIONS_ESSENTIAL: Array<{ key: FeedFilter; label: string }> = [
  { key: 'trending', label: 'TRENDING' },
  { key: 'news', label: 'NEWS' },
  { key: 'events', label: 'EVENTS' },
];

export const TREND_TAB_OPTIONS_ALL: Array<{ key: TrendTab; label: string; icon: string }> = [
  { key: 'picks', label: 'PICKS', icon: '🎯' },
  { key: 'hot', label: 'HOT', icon: '🔥' },
  { key: 'gainers', label: 'GAINERS', icon: '📈' },
  { key: 'dex', label: 'DEX', icon: '💎' },
];

export const TREND_TAB_OPTIONS_ESSENTIAL: Array<{ key: TrendTab; label: string; icon: string }> = [
  { key: 'picks', label: 'PICKS', icon: '🎯' },
  { key: 'hot', label: 'HOT', icon: '🔥' },
  { key: 'gainers', label: 'GAINERS', icon: '📈' },
];

export const TREND_BASIS: Record<TrendTab, string> = {
  picks: 'Source: /api/terminal/opportunity-scan · 기준: 모멘텀/거래량/소셜/매크로/온체인 복합 점수',
  hot: 'Source: CMC trending/latest (fallback: volume_24h desc) + LunarCrush 상위 10개 소셜 보강',
  gainers: 'Source: CMC gainers-losers 24h (fallback: listings %24h 정렬)',
  dex: 'Source: DexScreener boosts top + profiles latest · chain:address dedup · token market 메타 보강',
};

export const TREND_BASIS_COMPACT: Record<TrendTab, string> = {
  picks: 'Composite picks',
  hot: 'CMC + social trend',
  gainers: '24h leaders/laggards',
  dex: 'Dex boosts + profiles',
};

export const CRYPTO_RX = /\b(bitcoin|btc|ethereum|eth|solana|sol|crypto|defi|web3)\b/i;
