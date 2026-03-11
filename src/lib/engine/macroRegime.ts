// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Crypto Macro Regime Detector
// ═══════════════════════════════════════════════════════════════
// Classifies market into 5 regimes using cross-asset signals.
// Components: BTC Dominance, Fear&Greed, MVRV, DXY, SPX, US10Y
// Horizon: 1-3 months structural regime shifts.

export type MacroRegime =
  | 'RISK_ON'         // Strong bullish: low DXY, rising SPX, low fear, healthy MVRV
  | 'RISK_OFF'        // Defensive: rising DXY, falling SPX, high fear, deteriorating on-chain
  | 'ROTATION'        // BTC dominance shifting, altcoin rotation, mixed signals
  | 'EUPHORIA'        // Extreme greed everywhere — late cycle, bubble risk
  | 'CAPITULATION'    // Extreme fear + on-chain capitulation — cycle bottom
  | 'UNCERTAIN';      // Mixed signals, no clear regime

export interface MacroRegimeInput {
  // BTC Dominance
  btcDominance?: number | null;         // e.g., 54.2 (%)
  btcDomChange30d?: number | null;      // BTC.D change over 30 days (pp)

  // Fear & Greed
  fearGreed?: number | null;            // 0-100

  // On-chain
  mvrv?: number | null;
  nupl?: number | null;

  // Macro
  dxyChangePct?: number | null;         // DXY daily change %
  dxyTrend1m?: number | null;           // DXY 1-month trend %
  spxChangePct?: number | null;         // SPX daily change %
  spxTrend1m?: number | null;           // SPX 1-month trend %
  us10yChangePct?: number | null;       // US10Y yield change %

  // Derivatives
  fundingRate?: number | null;          // Current BTC funding rate
  oiChange24hPct?: number | null;       // OI change %
}

export interface MacroRegimeResult {
  regime: MacroRegime;
  confidence: number;          // 0-100
  scores: RegimeScore[];       // Per-regime scoring
  components: RegimeComponent[];
  summary: string;
  actionBias: 'AGGRESSIVE' | 'MODERATE' | 'CAUTIOUS' | 'DEFENSIVE';
}

export interface RegimeScore {
  regime: MacroRegime;
  score: number;
}

export interface RegimeComponent {
  name: string;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;   // 0-100
  label: string;
}

// ─── Component Analysis ─────────────────────────────────────

function analyzeFearGreed(fg: number | null): RegimeComponent {
  if (fg == null) return { name: 'fearGreed', signal: 'NEUTRAL', strength: 0, label: 'Fear & Greed: N/A' };
  const signal = fg <= 25 ? 'BEARISH' : fg >= 75 ? 'BULLISH' : 'NEUTRAL';
  // Note: "bearish" here means market is fearful (contrarian bullish, but regime = risk-off environment)
  const strength = Math.abs(fg - 50) * 2;
  const labels: Record<string, string> = {
    BEARISH: `F&G ${fg} — 공포 (Risk-Off 환경)`,
    BULLISH: `F&G ${fg} — 탐욕 (Risk-On 환경)`,
    NEUTRAL: `F&G ${fg} — 중립`,
  };
  return { name: 'fearGreed', signal, strength, label: labels[signal] };
}

function analyzeDXY(changePct: number | null, trend1m: number | null): RegimeComponent {
  if (changePct == null) return { name: 'dxy', signal: 'NEUTRAL', strength: 0, label: 'DXY: N/A' };
  const trend = trend1m ?? 0;
  const combined = changePct * 0.4 + trend * 0.6;
  const signal = combined > 1 ? 'BEARISH' : combined < -1 ? 'BULLISH' : 'NEUTRAL';
  const strength = Math.min(100, Math.abs(combined) * 25);
  return {
    name: 'dxy',
    signal,
    strength,
    label: `DXY ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}% (1m: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%)`,
  };
}

function analyzeSPX(changePct: number | null, trend1m: number | null): RegimeComponent {
  if (changePct == null) return { name: 'spx', signal: 'NEUTRAL', strength: 0, label: 'SPX: N/A' };
  const trend = trend1m ?? 0;
  const combined = changePct * 0.3 + trend * 0.7;
  const signal = combined > 1 ? 'BULLISH' : combined < -1 ? 'BEARISH' : 'NEUTRAL';
  const strength = Math.min(100, Math.abs(combined) * 20);
  return {
    name: 'spx',
    signal,
    strength,
    label: `SPX ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}% (1m: ${trend > 0 ? '+' : ''}${trend.toFixed(1)}%)`,
  };
}

function analyzeYield(changePct: number | null): RegimeComponent {
  if (changePct == null) return { name: 'yield', signal: 'NEUTRAL', strength: 0, label: 'US10Y: N/A' };
  const signal = changePct > 3 ? 'BEARISH' : changePct < -3 ? 'BULLISH' : 'NEUTRAL';
  const strength = Math.min(100, Math.abs(changePct) * 15);
  return {
    name: 'yield',
    signal,
    strength,
    label: `US10Y ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%`,
  };
}

function analyzeMVRV(mvrv: number | null): RegimeComponent {
  if (mvrv == null) return { name: 'mvrv', signal: 'NEUTRAL', strength: 0, label: 'MVRV: N/A' };
  let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (mvrv >= 3.0) signal = 'BEARISH';       // Overvalued
  else if (mvrv >= 2.0) signal = 'NEUTRAL';
  else if (mvrv >= 1.0) signal = 'BULLISH';  // Fair to undervalued
  else signal = 'BULLISH';                     // Deep value

  const strength = mvrv >= 2.0
    ? Math.min(100, (mvrv - 2) * 50)
    : mvrv <= 1.0
    ? Math.min(100, (1 - mvrv) * 100)
    : 30;

  return { name: 'mvrv', signal, strength, label: `MVRV ${mvrv.toFixed(2)}` };
}

function analyzeBTCDominance(dom: number | null, change30d: number | null): RegimeComponent {
  if (dom == null) return { name: 'btcDom', signal: 'NEUTRAL', strength: 0, label: 'BTC.D: N/A' };
  const change = change30d ?? 0;
  // Rising BTC.D = flight to quality = risk-off for alts
  // Falling BTC.D = alt rotation = risk-on
  const signal = change > 2 ? 'BEARISH' : change < -2 ? 'BULLISH' : 'NEUTRAL';
  const strength = Math.min(100, Math.abs(change) * 20);
  return {
    name: 'btcDom',
    signal,
    strength,
    label: `BTC.D ${dom.toFixed(1)}% (30d: ${change > 0 ? '+' : ''}${change.toFixed(1)}pp)`,
  };
}

function analyzeDerivatives(funding: number | null, oiChangePct: number | null): RegimeComponent {
  if (funding == null && oiChangePct == null) {
    return { name: 'derivatives', signal: 'NEUTRAL', strength: 0, label: 'Derivatives: N/A' };
  }
  let heat = 50;
  if (funding != null) {
    const fPct = funding * 100;
    heat += fPct > 0.05 ? 25 : fPct < -0.02 ? -25 : fPct * 300;
  }
  if (oiChangePct != null) {
    heat += oiChangePct > 10 ? 15 : oiChangePct < -10 ? -15 : oiChangePct * 1.2;
  }
  heat = Math.max(0, Math.min(100, heat));
  const signal = heat >= 70 ? 'BULLISH' : heat <= 30 ? 'BEARISH' : 'NEUTRAL';
  return {
    name: 'derivatives',
    signal,
    strength: Math.abs(heat - 50) * 2,
    label: `Deriv Heat ${Math.round(heat)}/100`,
  };
}

// ─── Regime Classification ──────────────────────────────────

export function detectMacroRegime(input: MacroRegimeInput): MacroRegimeResult {
  const components = [
    analyzeFearGreed(input.fearGreed ?? null),
    analyzeDXY(input.dxyChangePct ?? null, input.dxyTrend1m ?? null),
    analyzeSPX(input.spxChangePct ?? null, input.spxTrend1m ?? null),
    analyzeYield(input.us10yChangePct ?? null),
    analyzeMVRV(input.mvrv ?? null),
    analyzeBTCDominance(input.btcDominance ?? null, input.btcDomChange30d ?? null),
    analyzeDerivatives(input.fundingRate ?? null, input.oiChange24hPct ?? null),
  ];

  const bullish = components.filter(c => c.signal === 'BULLISH');
  const bearish = components.filter(c => c.signal === 'BEARISH');
  const active = components.filter(c => c.strength > 0);

  const bullStr = bullish.reduce((s, c) => s + c.strength, 0);
  const bearStr = bearish.reduce((s, c) => s + c.strength, 0);

  // ── Score each regime ──
  const fg = input.fearGreed ?? 50;
  const mvrv = input.mvrv ?? 1.5;

  const scores: RegimeScore[] = [
    {
      regime: 'RISK_ON',
      score: scoreRiskOn(bullish.length, active.length, bullStr, fg, mvrv),
    },
    {
      regime: 'RISK_OFF',
      score: scoreRiskOff(bearish.length, active.length, bearStr, fg, mvrv),
    },
    {
      regime: 'ROTATION',
      score: scoreRotation(input.btcDomChange30d ?? null, bullish.length, bearish.length),
    },
    {
      regime: 'EUPHORIA',
      score: scoreEuphoria(fg, mvrv, input.fundingRate ?? null, input.nupl ?? null),
    },
    {
      regime: 'CAPITULATION',
      score: scoreCapitulation(fg, mvrv, input.nupl ?? null),
    },
    {
      regime: 'UNCERTAIN',
      score: 20, // Base score — wins only when nothing else is strong
    },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  const confidence = Math.min(95, Math.max(20, best.score - second.score + 40));

  const regime = best.regime;
  const actionBias = getActionBias(regime);
  const summary = buildRegimeSummary(regime, confidence, components);

  return { regime, confidence, scores, components, summary, actionBias };
}

function scoreRiskOn(bullCount: number, activeCount: number, bullStr: number, fg: number, mvrv: number): number {
  let s = 0;
  if (activeCount > 0) s += (bullCount / activeCount) * 40;
  s += Math.min(30, bullStr / 10);
  if (fg >= 50 && fg < 80) s += 15;
  if (mvrv >= 1.0 && mvrv < 2.5) s += 15;
  return Math.round(s);
}

function scoreRiskOff(bearCount: number, activeCount: number, bearStr: number, fg: number, mvrv: number): number {
  let s = 0;
  if (activeCount > 0) s += (bearCount / activeCount) * 40;
  s += Math.min(30, bearStr / 10);
  if (fg <= 35) s += 15;
  if (mvrv >= 2.5) s += 10; // Overvalued in risk-off = double danger
  return Math.round(s);
}

function scoreRotation(btcDomChange: number | null, bullCount: number, bearCount: number): number {
  let s = 0;
  if (btcDomChange != null && Math.abs(btcDomChange) >= 3) s += 40;
  else if (btcDomChange != null && Math.abs(btcDomChange) >= 1.5) s += 20;
  // Mixed signals = rotation
  if (bullCount >= 2 && bearCount >= 2) s += 25;
  return Math.round(Math.min(80, s));
}

function scoreEuphoria(fg: number, mvrv: number, funding: number | null, nupl: number | null): number {
  let s = 0;
  if (fg >= 80) s += 30;
  else if (fg >= 70) s += 15;
  if (mvrv >= 3.0) s += 30;
  else if (mvrv >= 2.5) s += 15;
  if (funding != null && funding * 100 > 0.08) s += 20;
  if (nupl != null && nupl > 0.7) s += 20;
  return Math.round(Math.min(90, s));
}

function scoreCapitulation(fg: number, mvrv: number, nupl: number | null): number {
  let s = 0;
  if (fg <= 15) s += 35;
  else if (fg <= 25) s += 20;
  if (mvrv <= 0.8) s += 30;
  else if (mvrv <= 1.0) s += 15;
  if (nupl != null && nupl < -0.1) s += 25;
  else if (nupl != null && nupl < 0.1) s += 10;
  return Math.round(Math.min(90, s));
}

function getActionBias(regime: MacroRegime): 'AGGRESSIVE' | 'MODERATE' | 'CAUTIOUS' | 'DEFENSIVE' {
  switch (regime) {
    case 'RISK_ON': return 'AGGRESSIVE';
    case 'CAPITULATION': return 'AGGRESSIVE'; // Contrarian
    case 'ROTATION': return 'MODERATE';
    case 'UNCERTAIN': return 'CAUTIOUS';
    case 'RISK_OFF': return 'DEFENSIVE';
    case 'EUPHORIA': return 'DEFENSIVE'; // Contrarian
  }
}

function buildRegimeSummary(regime: MacroRegime, confidence: number, components: RegimeComponent[]): string {
  const labels: Record<MacroRegime, string> = {
    RISK_ON: '리스크 온 — 강세 환경. 적극 매수 구간.',
    RISK_OFF: '리스크 오프 — 방어 환경. 현금 비중 확대.',
    ROTATION: '로테이션 — BTC↔ALT 순환. 섹터 선별 중요.',
    EUPHORIA: '유포리아 — 극단적 탐욕. 차익실현 구간.',
    CAPITULATION: '항복 — 극단적 공포. 역발상 매수 기회.',
    UNCERTAIN: '불확실 — 혼재 신호. 관망 권장.',
  };

  const active = components.filter(c => c.strength > 0);
  const signals = active.map(c => `${c.label}`).join(' · ');

  return `[${regime}] ${labels[regime]} (신뢰도 ${confidence}%)\n${signals}`;
}

// ─── UI Helpers ─────────────────────────────────────────────

export function regimeColor(regime: MacroRegime): string {
  switch (regime) {
    case 'RISK_ON': return '#00ff88';
    case 'RISK_OFF': return '#ff4060';
    case 'ROTATION': return '#ffbb33';
    case 'EUPHORIA': return '#ff00ff';
    case 'CAPITULATION': return '#00d4ff';
    case 'UNCERTAIN': return '#888888';
  }
}

export function regimeIcon(regime: MacroRegime): string {
  switch (regime) {
    case 'RISK_ON': return '🟢';
    case 'RISK_OFF': return '🔴';
    case 'ROTATION': return '🔄';
    case 'EUPHORIA': return '🌋';
    case 'CAPITULATION': return '🧊';
    case 'UNCERTAIN': return '⚪';
  }
}

export function actionBiasLabel(bias: 'AGGRESSIVE' | 'MODERATE' | 'CAUTIOUS' | 'DEFENSIVE'): string {
  switch (bias) {
    case 'AGGRESSIVE': return '공격적 매수';
    case 'MODERATE': return '선별적 매수';
    case 'CAUTIOUS': return '관망';
    case 'DEFENSIVE': return '방어/현금';
  }
}
