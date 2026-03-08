// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Crypto Market Heat Score Engine
// ═══════════════════════════════════════════════════════════════
// Aggregates OI/Funding/Liq/MVRV/FNG into a 0-100 heat score.
// 0 = extreme cold (oversold/capitulation), 100 = extreme hot (overbought/euphoria)
// Designed for tactical 2-8 week timing signals.

export interface HeatScoreInput {
  // Derivatives (from Coinalyze)
  fundingRate?: number | null;          // Current funding rate (e.g., 0.0001 = 0.01%)
  oiChange24hPct?: number | null;       // OI change in last 24h (%)
  lsRatio?: number | null;             // Long/Short ratio (e.g., 1.5 = more longs)
  liqLong24h?: number | null;           // Long liquidations 24h (USD)
  liqShort24h?: number | null;          // Short liquidations 24h (USD)

  // On-chain (from CryptoQuant)
  mvrv?: number | null;                 // MVRV ratio
  nupl?: number | null;                 // Net Unrealized Profit/Loss
  exchangeNetflow7d?: number | null;    // Exchange reserve change 7d (%)

  // Sentiment
  fearGreed?: number | null;            // Fear & Greed Index (0-100)
}

export interface HeatScoreResult {
  score: number;             // 0-100 composite heat score
  zone: HeatZone;            // Classification
  components: HeatComponent[];
  summary: string;           // Human-readable summary
}

export type HeatZone =
  | 'EXTREME_COLD'    // 0-15:  Capitulation — strong buy signal
  | 'COLD'            // 15-30: Fear/undervalued — accumulation zone
  | 'COOL'            // 30-40: Below neutral — leaning bullish
  | 'NEUTRAL'         // 40-60: Balanced — no strong signal
  | 'WARM'            // 60-70: Above neutral — caution
  | 'HOT'             // 70-85: Overheated — reduce exposure
  | 'EXTREME_HOT';    // 85-100: Euphoria — strong sell signal

export interface HeatComponent {
  name: string;
  value: number | null;
  score: number;       // 0-100 (contribution to heat)
  weight: number;      // Relative weight
  label: string;       // Display label
}

// ─── Component Weights ──────────────────────────────────────

const WEIGHTS = {
  funding: 20,
  oiMomentum: 15,
  lsRatio: 10,
  liqImbalance: 10,
  mvrv: 20,
  nupl: 10,
  exchangeFlow: 5,
  fearGreed: 10,
} as const;

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);

// ─── Scoring Functions (each returns 0-100) ─────────────────

/** Funding rate → heat. High positive = overheated longs. Negative = shorts crowded. */
function scoreFunding(rate: number | null): number {
  if (rate == null) return 50;
  // rate is typically -0.001 to +0.003
  const pct = rate * 100; // convert to percentage
  if (pct >= 0.1) return 95;     // Extreme greed funding
  if (pct >= 0.05) return 80;
  if (pct >= 0.02) return 65;
  if (pct >= 0.005) return 55;
  if (pct >= -0.005) return 50;  // Neutral
  if (pct >= -0.02) return 40;
  if (pct >= -0.05) return 30;
  return 10;                      // Extreme negative = oversold
}

/** OI change momentum → heat. Rising OI = more speculation = hotter. */
function scoreOIMomentum(changePct: number | null): number {
  if (changePct == null) return 50;
  if (changePct >= 15) return 90;
  if (changePct >= 8) return 75;
  if (changePct >= 3) return 60;
  if (changePct >= -3) return 50;
  if (changePct >= -8) return 35;
  if (changePct >= -15) return 20;
  return 10;                      // OI crashing = capitulation
}

/** L/S ratio → heat. >1 = more longs = hotter. <1 = more shorts = cooler. */
function scoreLSRatio(ratio: number | null): number {
  if (ratio == null) return 50;
  if (ratio >= 2.0) return 90;
  if (ratio >= 1.5) return 75;
  if (ratio >= 1.1) return 60;
  if (ratio >= 0.9) return 50;
  if (ratio >= 0.7) return 35;
  if (ratio >= 0.5) return 20;
  return 10;
}

/** Liquidation imbalance → heat. More long liqs = cooling down. More short liqs = heating up. */
function scoreLiqImbalance(longLiq: number | null, shortLiq: number | null): number {
  if (longLiq == null || shortLiq == null) return 50;
  const total = longLiq + shortLiq;
  if (total < 1000) return 50; // Too small to matter
  const longRatio = longLiq / total;
  // longRatio near 1 = longs getting rekt = market cooling
  // longRatio near 0 = shorts getting rekt = market heating
  return Math.round(Math.max(5, Math.min(95, (1 - longRatio) * 100)));
}

/** MVRV → heat. >3.5 = extreme hot. <1 = extreme cold. */
function scoreMVRV(mvrv: number | null): number {
  if (mvrv == null) return 50;
  if (mvrv >= 3.5) return 95;
  if (mvrv >= 2.5) return 80;
  if (mvrv >= 1.5) return 60;
  if (mvrv >= 1.0) return 45;
  if (mvrv >= 0.8) return 25;
  return 10;
}

/** NUPL → heat. >0.75 euphoria, <0 capitulation. */
function scoreNUPL(nupl: number | null): number {
  if (nupl == null) return 50;
  if (nupl >= 0.75) return 95;
  if (nupl >= 0.5) return 75;
  if (nupl >= 0.25) return 55;
  if (nupl >= 0) return 40;
  if (nupl >= -0.25) return 20;
  return 5;
}

/** Exchange flow → heat. Inflows = selling pressure = heating top. Outflows = accumulation = cooling. */
function scoreExchangeFlow(change7dPct: number | null): number {
  if (change7dPct == null) return 50;
  if (change7dPct >= 5) return 85;
  if (change7dPct >= 2) return 70;
  if (change7dPct >= 0) return 55;
  if (change7dPct >= -2) return 40;
  if (change7dPct >= -5) return 25;
  return 10;
}

/** Fear & Greed → heat. Direct mapping. */
function scoreFearGreed(fg: number | null): number {
  if (fg == null) return 50;
  return Math.max(0, Math.min(100, fg));
}

// ─── Composite Calculator ───────────────────────────────────

export function calculateHeatScore(input: HeatScoreInput): HeatScoreResult {
  const components: HeatComponent[] = [
    {
      name: 'funding',
      value: input.fundingRate ?? null,
      score: scoreFunding(input.fundingRate ?? null),
      weight: WEIGHTS.funding,
      label: 'Funding Rate',
    },
    {
      name: 'oiMomentum',
      value: input.oiChange24hPct ?? null,
      score: scoreOIMomentum(input.oiChange24hPct ?? null),
      weight: WEIGHTS.oiMomentum,
      label: 'OI Momentum',
    },
    {
      name: 'lsRatio',
      value: input.lsRatio ?? null,
      score: scoreLSRatio(input.lsRatio ?? null),
      weight: WEIGHTS.lsRatio,
      label: 'L/S Ratio',
    },
    {
      name: 'liqImbalance',
      value: null,
      score: scoreLiqImbalance(input.liqLong24h ?? null, input.liqShort24h ?? null),
      weight: WEIGHTS.liqImbalance,
      label: 'Liq Imbalance',
    },
    {
      name: 'mvrv',
      value: input.mvrv ?? null,
      score: scoreMVRV(input.mvrv ?? null),
      weight: WEIGHTS.mvrv,
      label: 'MVRV',
    },
    {
      name: 'nupl',
      value: input.nupl ?? null,
      score: scoreNUPL(input.nupl ?? null),
      weight: WEIGHTS.nupl,
      label: 'NUPL',
    },
    {
      name: 'exchangeFlow',
      value: input.exchangeNetflow7d ?? null,
      score: scoreExchangeFlow(input.exchangeNetflow7d ?? null),
      weight: WEIGHTS.exchangeFlow,
      label: 'Exchange Flow',
    },
    {
      name: 'fearGreed',
      value: input.fearGreed ?? null,
      score: scoreFearGreed(input.fearGreed ?? null),
      weight: WEIGHTS.fearGreed,
      label: 'Fear & Greed',
    },
  ];

  // Weighted average
  let weightedSum = 0;
  let activeWeight = 0;
  for (const c of components) {
    // Only count components with real data (not defaulting to 50)
    const hasData = c.value != null || c.name === 'liqImbalance';
    if (hasData || c.score !== 50) {
      weightedSum += c.score * c.weight;
      activeWeight += c.weight;
    }
  }

  const score = activeWeight > 0
    ? Math.round(Math.max(0, Math.min(100, weightedSum / activeWeight)))
    : 50;

  const zone = classifyZone(score);
  const summary = buildSummary(score, zone, components);

  return { score, zone, components, summary };
}

function classifyZone(score: number): HeatZone {
  if (score <= 15) return 'EXTREME_COLD';
  if (score <= 30) return 'COLD';
  if (score <= 40) return 'COOL';
  if (score <= 60) return 'NEUTRAL';
  if (score <= 70) return 'WARM';
  if (score <= 85) return 'HOT';
  return 'EXTREME_HOT';
}

function buildSummary(score: number, zone: HeatZone, components: HeatComponent[]): string {
  const labels: Record<HeatZone, string> = {
    EXTREME_COLD: '극단적 공포 — 항복 구간. 역발상 매수 시그널.',
    COLD: '공포/저평가 — 축적 구간.',
    COOL: '약간 냉각 — 중립 이하, 완만한 강세.',
    NEUTRAL: '균형 — 뚜렷한 방향성 없음.',
    WARM: '과열 조짐 — 경계 필요.',
    HOT: '과열 — 포지션 축소 권장.',
    EXTREME_HOT: '극단적 탐욕 — 유포리아. 역발상 매도 시그널.',
  };

  const hottest = [...components]
    .filter(c => c.value != null)
    .sort((a, b) => b.score - a.score)[0];
  const coldest = [...components]
    .filter(c => c.value != null)
    .sort((a, b) => a.score - b.score)[0];

  let summary = `Heat ${score}/100 — ${labels[zone]}`;
  if (hottest && hottest.score >= 70) {
    summary += ` 가장 뜨거운 신호: ${hottest.label}(${hottest.score}).`;
  }
  if (coldest && coldest.score <= 30) {
    summary += ` 가장 차가운 신호: ${coldest.label}(${coldest.score}).`;
  }
  return summary;
}

// ─── Color helpers for UI ───────────────────────────────────

export function heatScoreColor(score: number): string {
  if (score <= 15) return '#00d4ff';   // Ice blue
  if (score <= 30) return '#00ff88';   // Green
  if (score <= 40) return '#88ff88';   // Light green
  if (score <= 60) return '#ffbb33';   // Orange
  if (score <= 70) return '#ff8844';   // Dark orange
  if (score <= 85) return '#ff4444';   // Red
  return '#ff0040';                     // Hot red
}

export function heatZoneEmoji(zone: HeatZone): string {
  const map: Record<HeatZone, string> = {
    EXTREME_COLD: '🧊',
    COLD: '❄️',
    COOL: '🌤',
    NEUTRAL: '⚖️',
    WARM: '🌡',
    HOT: '🔥',
    EXTREME_HOT: '🌋',
  };
  return map[zone];
}
