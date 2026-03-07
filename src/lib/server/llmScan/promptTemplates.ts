// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — LLM Scan Engine (C-02) Prompt Templates
// ═══════════════════════════════════════════════════════════════
//
// Fine-grained prompts per agent (설계서 Section 3-5).
// Key principle: pre-computed indicators + specific questions
// → "Fine-grained > Coarse-grained" (Paper 2, Sharpe +0.4~0.66)

import type { AgentId } from '$lib/engine/types';
import type { LLMMessage } from '$lib/server/llmService';
import type { AgentVerdict, MarketSnapshot, RAGScanResult, SynthesisResult } from './types';

// ─── Formatting helpers ─────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2, fallback = '—'): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  return n.toFixed(decimals);
}

function fmtPct(n: number | null | undefined, fallback = '—'): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtCompact(n: number | null | undefined, fallback = '—'): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtFunding(n: number | null | undefined, fallback = '—'): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  return `${(n * 100).toFixed(4)}%`;
}

function smaDistance(price: number, sma: number | null): string {
  if (sma == null) return '—';
  const pct = ((price - sma) / sma) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}% (${price > sma ? 'above' : 'below'})`;
}

function smaAlignment(sma20: number | null, sma60: number | null, sma120: number | null): string {
  if (sma20 == null || sma60 == null || sma120 == null) return 'unknown';
  if (sma20 > sma60 && sma60 > sma120) return 'bullish (20>60>120)';
  if (sma20 < sma60 && sma60 < sma120) return 'bearish (20<60<120)';
  return 'mixed';
}

// ─── MTF & S/R formatting helpers ────────────────────────────

/** Full MTF context block — for STRUCTURE and Commander */
function formatMTFContext(s: MarketSnapshot): string {
  if (!s.mtf) return '';
  const lines = [
    `\n── MULTI-TIMEFRAME CONTEXT ──`,
    `Consensus: ${s.mtf.consensusBias.toUpperCase()} ${s.mtf.consensusConfidence}% | Alignment: ${s.mtf.alignmentPct}%`,
  ];
  for (const snap of s.mtf.snapshots) {
    lines.push(`  ${snap.timeframe}: ${snap.bias.toUpperCase()} ${snap.confidence}% | EMA ${snap.emaTrend} | RSI ${snap.rsi14.toFixed(0)} | MACD ${snap.macdState}`);
  }
  return lines.join('\n');
}

/** One-line MTF summary — for other agents (token-efficient) */
function formatMTFSummary(s: MarketSnapshot): string {
  if (!s.mtf) return '';
  return `\nMTF consensus: ${s.mtf.consensusBias.toUpperCase()} ${s.mtf.consensusConfidence}% | ${s.mtf.alignmentPct}% aligned`;
}

/** S/R levels block — for STRUCTURE, ICT, Commander */
function formatSRLevels(s: MarketSnapshot): string {
  if (!s.srLevels || s.srLevels.length === 0) return '';
  const resistances = s.srLevels.filter((l) => l.type === 'resistance');
  const supports = s.srLevels.filter((l) => l.type === 'support');
  const lines = [`\n── KEY SUPPORT/RESISTANCE LEVELS ──`];
  if (resistances.length > 0) {
    lines.push(`Resistance: ${resistances.map((r) => `$${fmt(r.price, r.price >= 100 ? 0 : 4)} (${r.timeframe}, str=${r.strength})`).join(' | ')}`);
  }
  if (supports.length > 0) {
    lines.push(`Support: ${supports.map((r) => `$${fmt(r.price, r.price >= 100 ? 0 : 4)} (${r.timeframe}, str=${r.strength})`).join(' | ')}`);
  }
  return lines.join('\n');
}

// ─── Common system message ──────────────────────────────────

const SYSTEM_SUFFIX = `
RULES:
- Output ONLY valid JSON, no other text
- "reasoning" must be in Korean, under 50 characters
- "confidence" is 0-100 integer
- "direction" must be "long", "short", or "neutral"`;

// ═══════════════════════════════════════════════════════════════
// Level 1: Analyst Agent Prompts
// ═══════════════════════════════════════════════════════════════

function buildStructurePrompt(s: MarketSnapshot): string {
  const c = s.candles;
  return `You are STRUCTURE, a technical analysis agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- RSI(14): ${fmt(c.rsi14, 1)}
- Price vs SMA20: ${smaDistance(s.latestClose, c.sma20)}
- Price vs SMA60: ${smaDistance(s.latestClose, c.sma60)}
- Price vs SMA120: ${smaDistance(s.latestClose, c.sma120)}
- SMA alignment: ${smaAlignment(c.sma20, c.sma60, c.sma120)}
- ATR%: ${fmt(c.atrPct)}
- Trend structure: ${c.trendStructure}
- Recent candle pattern: ${c.recentPattern ?? 'none'}
- Bollinger position: ${c.priceVsBollinger}
${formatMTFContext(s)}${formatSRLevels(s)}

TASKS (answer each):
1. TREND: Is the current trend continuation or exhaustion? (SMA alignment + trend structure + RSI)
2. MOMENTUM: Is momentum strengthening or weakening? (RSI slope + ATR% + price vs SMA20)
3. REVERSAL_RISK: Are there reversal signals? (candle pattern + Bollinger extreme + RSI >70/<30)
4. HTF_ALIGNMENT: 상위 타임프레임(1D/1W) 방향과 현재 ${s.timeframe} 추세가 일치하는가? 역추세면 확신도 감산.

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"trend_assessment":"continuation|exhaustion|unclear","momentum":"strengthening|weakening|flat","reversal_risk":"low|medium|high","reasoning":"<50자 한국어>"}`;
}

function buildDerivPrompt(s: MarketSnapshot): string {
  const d = s.derivatives;
  return `You are DERIV, a derivatives analysis agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- Funding rate: ${fmtFunding(d.funding)} (양수=롱과밀, 음수=숏과밀)
- Predicted funding: ${fmtFunding(d.predictedFunding)}
- L/S ratio: ${fmt(d.lsRatio)} (>1=롱우세)
- Liquidation 24h: Long $${fmtCompact(d.liqLong24h)} / Short $${fmtCompact(d.liqShort24h)}
- OI change 24h: ${fmtPct(d.oiChangePercent)}
- Price change 24h: ${fmtPct(s.candles.change24h)}
- OI value: $${fmtCompact(d.openInterest)}${formatMTFSummary(s)}

TASKS:
1. CROWDING: 한쪽에 포지션이 과도하게 쏠려있는가? (funding extreme + L/S skew)
2. SQUEEZE: 스퀴즈 가능성은? (high funding + skewed L/S + low ATR = squeeze setup)
3. DIVERGENCE: OI와 가격이 다이버전스인가? (price↑+OI↓=약한 랠리, price↓+OI↑=강한 매도)

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"crowding":"none|long_crowded|short_crowded","squeeze_potential":"low|medium|high","divergence":"none|bearish_div|bullish_div","reasoning":"<50자 한국어>"}`;
}

function buildFlowPrompt(s: MarketSnapshot): string {
  const o = s.onchain;
  return `You are FLOW, an on-chain fund flow agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- Exchange netflow: ${fmtCompact(o.exchangeNetflow)} (+=입금=매도압력)
- Whale netflow: ${fmtCompact(o.whaleNetflow)} (+=거래소입금=매도)
- Miner outflow 24h: ${fmtCompact(o.minerOutflow)}
- Exchange reserve 7d change: ${fmtPct(o.exchangeReserveChange7dPct)}
- Volume ratio: x${fmt(s.candles.volumeRatio)}
- 24h change: ${fmtPct(s.candles.change24h)}${formatMTFSummary(s)}

TASKS:
1. ACCUMULATION: 축적 vs 분배 단계인가? (exchange reserve trend + netflow direction)
2. WHALE: 고래 행동이 방향을 지지하는가? (whale netflow direction + size)
3. MINER: 채굴자 매도 압력이 있는가? (miner outflow level)

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"reasoning":"<50자 한국어>"}`;
}

function buildVpaPrompt(s: MarketSnapshot): string {
  const v = s.vpa;
  return `You are VPA, a Volume Price Analysis agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- CVD ratio: ${fmtPct(v.cvdRatio * 100)} (양=매수우위, 음=매도우위)
- Buy volume %: ${fmt(v.buyVolPercent, 0)}%
- Volume ratio: x${fmt(v.volumeRatio)} (현재/20봉 평균)
- Absorption candles (last 5): ${v.absorptionCount}개
- 24h change: ${fmtPct(s.candles.change24h)}
- Trend: ${s.candles.trendStructure}${formatMTFSummary(s)}

TASKS:
1. VOLUME_CONFIRM: 거래량이 현재 추세를 확인하는가? (CVD + volume ratio + trend)
2. DIVERGENCE: 거래량/가격 괴리가 있는가? (price up + volume down = weak)
3. ABSORPTION: 흡수 패턴이 감지되는가? (high volume + small body = absorption)

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"reasoning":"<50자 한국어>"}`;
}

function buildIctPrompt(s: MarketSnapshot): string {
  const i = s.ict;
  return `You are ICT, a Smart Money Concepts agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- Price position (50-bar range): ${fmt(i.pricePosition50 * 100, 0)}% (0=low, 100=high)
- Range: ${fmt(i.range50Low)}-${fmt(i.range50High)}
- FVG count: Bull ${i.bullFvgCount} / Bear ${i.bearFvgCount}
- Structure break: ${i.recentHighBreak ? 'Bullish BOS (HH)' : i.recentLowBreak ? 'Bearish BOS (LL)' : 'No BOS'}
- Trend: ${s.candles.trendStructure}
${formatMTFSummary(s)}${formatSRLevels(s)}

TASKS:
1. LIQUIDITY: 유동성 풀(스탑헌팅 타겟) 방향은? (price position + range extremes)
2. FVG: 공정가치갭이 어느 방향을 지지하는가? (bull vs bear FVG count)
3. SMART_MONEY: 스마트머니 흔적이 있는가? (BOS direction + price position)
4. SR_CONFLUENCE: S/R 레벨과 유동성 풀/FVG가 겹치는 구간이 있는가? 겹치면 해당 레벨의 신뢰도 높음.

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"reasoning":"<50자 한국어>"}`;
}

function buildSentiPrompt(s: MarketSnapshot): string {
  const se = s.sentiment;
  return `You are SENTI, a sentiment analysis agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- Fear & Greed Index: ${fmt(se.fearGreedIndex, 0)} (${se.fearGreedLabel ?? '—'})
- Social sentiment: ${fmt(se.socialSentiment, 1)}/5
- Social dominance: ${fmt(se.socialDominance)}%
- Galaxy Score: ${fmt(se.galaxyScore, 0)}
- Social interactions 24h: ${fmtCompact(se.socialInteractions24h)}
- RSI: ${fmt(s.candles.rsi14, 1)}
- Funding rate: ${fmtFunding(s.derivatives.funding)}${formatMTFSummary(s)}

TASKS:
1. CROWD: 군중 심리가 극단에 있는가? (F&G extreme + social sentiment extreme)
2. SOCIAL: 소셜 신호가 어느 방향을 가리키는가? (sentiment + dominance + interactions)
3. CONTRARIAN: 역발상 기회가 있는가? (극단 센티먼트 = 반전 가능)

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"reasoning":"<50자 한국어>"}`;
}

function buildMacroPrompt(s: MarketSnapshot): string {
  const m = s.macro;
  return `You are MACRO, a macro analysis agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- DXY: ${m.dxy ? `${fmt(m.dxy.value)} ${fmtPct(m.dxy.change1d)} 1m:${fmtPct(m.dxy.trend1m)}` : '—'}
- S&P 500: ${m.spx ? `${fmtCompact(m.spx.value)} ${fmtPct(m.spx.change1d)} 1m:${fmtPct(m.spx.trend1m)}` : '—'}
- US 10Y yield: ${m.us10y ? `${fmt(m.us10y.value)}% ${fmtPct(m.us10y.change1d)}` : '—'}
- Fed Funds Rate: ${fmt(m.fedFundsRate)}%
- Yield Curve (10y-2y): ${fmt(m.yieldCurve)} (음수=역전)
- M2 change: ${fmtPct(m.m2ChangePercent)}
- BTC Dominance: ${fmt(m.btcDominance, 1)}%
- Total MktCap 24h: ${fmtPct(m.totalMarketCapChange24h)}
- Regime: ${s.candles.sma120 != null ? (s.latestClose >= s.candles.sma120 ? 'risk-on' : 'risk-off') : '—'}${formatMTFSummary(s)}

TASKS:
1. RISK_APPETITE: 위험자산 선호도가 올라가고 있는가? (equity trend + yield move + DXY)
2. LIQUIDITY: 글로벌 유동성이 확장 중인가? (M2 + yield curve + fed rate)
3. CORRELATION: BTC-전통자산 상관 관계가 현재 방향을 지지하는가?

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"reasoning":"<50자 한국어>"}`;
}

function buildValuationPrompt(s: MarketSnapshot): string {
  const o = s.onchain;
  const c = s.candles;
  const deviation = c.sma120 != null ? ((s.latestClose - c.sma120) / c.sma120) * 100 : null;

  return `You are VALUATION, an on-chain valuation agent for ${s.pair} ${s.timeframe}.

INDICATORS:
- MA120 deviation: ${fmtPct(deviation)} (양=고평가, 음=저평가)
- RSI(14): ${fmt(c.rsi14, 1)}
- MVRV: ${fmt(o.mvrv)} (>3=과열, <1=저평가)
- NUPL: ${fmt(o.nupl, 3)} (>0.75=극탐, <0=항복)
- Volume ratio: x${fmt(c.volumeRatio)}
- Total MktCap 24h: ${fmtPct(s.macro.totalMarketCapChange24h)}${formatMTFSummary(s)}

TASKS:
1. OVERVALUATION: 현재 가격이 과대/과소 평가 상태인가? (MVRV + MA120 deviation)
2. MEAN_REVERSION: 평균회귀 압력이 있는가? (extreme RSI + high deviation)
3. CYCLE: 현재 시장 사이클에서 어디 위치인가? (NUPL zone + MVRV zone)

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"reasoning":"<50자 한국어>"}`;
}

// ─── Analyst prompt dispatcher ──────────────────────────────

const ANALYST_BUILDERS: Record<string, (s: MarketSnapshot) => string> = {
  STRUCTURE: buildStructurePrompt,
  DERIV: buildDerivPrompt,
  FLOW: buildFlowPrompt,
  VPA: buildVpaPrompt,
  ICT: buildIctPrompt,
  SENTI: buildSentiPrompt,
  MACRO: buildMacroPrompt,
  VALUATION: buildValuationPrompt,
};

export function buildAnalystMessages(agentId: AgentId, snapshot: MarketSnapshot): LLMMessage[] {
  const builder = ANALYST_BUILDERS[agentId];
  if (!builder) {
    throw new Error(
      `[C-02:prompt] Unknown agent ID: ${agentId}\n수정: ANALYST_BUILDERS에 해당 ID 추가\n예시: STRUCTURE, DERIV, FLOW, VPA, ICT, SENTI, MACRO, VALUATION`,
    );
  }

  return [
    { role: 'system', content: `You are a cryptocurrency market analyst agent.${SYSTEM_SUFFIX}` },
    { role: 'user', content: builder(snapshot) },
  ];
}

// ═══════════════════════════════════════════════════════════════
// Level 2: Synthesis Agent Prompts
// ═══════════════════════════════════════════════════════════════

function formatVerdict(v: AgentVerdict): string {
  return `${v.agentId}: ${v.direction.toUpperCase()} ${v.confidence}% — ${v.reasoning}`;
}

export function buildSynthesisMessages(
  role: 'offense' | 'defense',
  verdicts: AgentVerdict[],
  snapshot: MarketSnapshot,
): LLMMessage[] {
  const agentList = verdicts.map(formatVerdict).join('\n');

  const roleDesc = role === 'offense'
    ? 'OFFENSE SYNTHESIZER (기술적 분석 종합: STRUCTURE + VPA + ICT)'
    : 'DEFENSE SYNTHESIZER (환경/거시 분석 종합: DERIV + FLOW + SENTI + MACRO + VALUATION)';

  const prompt = `You are ${roleDesc} for ${snapshot.pair} ${snapshot.timeframe}.

ANALYST RESULTS:
${agentList}

CURRENT: Price $${fmt(snapshot.latestClose, snapshot.latestClose >= 100 ? 0 : 4)} | 24h ${fmtPct(snapshot.candles.change24h)} | RSI ${fmt(snapshot.candles.rsi14, 1)}

TASKS:
1. AGREEMENT: ${verdicts.length}개 에이전트가 얼마나 일치하는가?
2. CONFLICT_RESOLUTION: 불일치 시 어느 쪽이 현재 시장에서 더 신뢰할 만한가?
3. COMBINED_SIGNAL: 종합 방향

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"agreement_level":"strong|moderate|weak","key_factor":"<가장 중요한 근거>","reasoning":"<50자 한국어>"}`;

  return [
    { role: 'system', content: `You are a synthesis agent that combines multiple analyst opinions.${SYSTEM_SUFFIX}` },
    { role: 'user', content: prompt },
  ];
}

// ═══════════════════════════════════════════════════════════════
// Level 3: Commander Prompt
// ═══════════════════════════════════════════════════════════════

export function buildCommanderMessages(
  offense: SynthesisResult,
  defense: SynthesisResult,
  rag: RAGScanResult | null,
  snapshot: MarketSnapshot,
): LLMMessage[] {
  const ragSection = rag && rag.similarCases > 0
    ? `HISTORICAL CONTEXT (RAG):
  Similar cases found: ${rag.similarCases}
  Long win rate: ${fmt(rag.longWinRate, 0)}%
  Short win rate: ${fmt(rag.shortWinRate, 0)}%
  Recent trend: ${rag.recentTrend}
  Past lesson: ${rag.lesson}`
    : 'HISTORICAL CONTEXT: No similar past cases found.';

  const prompt = `You are COMMANDER, the final decision maker for ${snapshot.pair} ${snapshot.timeframe}.

OFFENSE (기술적 분석 종합):
  Direction: ${offense.direction.toUpperCase()} | Confidence: ${offense.confidence}%
  Agreement: ${offense.agreementLevel}
  Key factor: ${offense.keyFactor}
  Reasoning: ${offense.reasoning}

DEFENSE (환경 분석 종합):
  Direction: ${defense.direction.toUpperCase()} | Confidence: ${defense.confidence}%
  Agreement: ${defense.agreementLevel}
  Key factor: ${defense.keyFactor}
  Reasoning: ${defense.reasoning}

${ragSection}

CURRENT PRICE: $${fmt(snapshot.latestClose, snapshot.latestClose >= 100 ? 0 : 4)}
ATR%: ${fmt(snapshot.candles.atrPct)}
24h change: ${fmtPct(snapshot.candles.change24h)}
${formatMTFContext(snapshot)}${formatSRLevels(snapshot)}

TASKS:
1. CONFLICT_CHECK: Offense와 Defense가 충돌하는가? 충돌 시 어느 쪽을 신뢰?
2. RAG_ADJUSTMENT: 과거 유사 상황이 현재 판단을 어떻게 조정하는가?
3. HTF_FILTER: HTF(1D/1W) 방향과 반대 포지션이면 확신도를 10-20% 감산. 정합 시 5-10% 가산.
4. SR_OPTIMIZED_LEVELS: TP는 가장 가까운 저항(long) 또는 지지(short) 부근으로 설정. SL은 가장 가까운 지지(long) 또는 저항(short) 너머로 설정. S/R 레벨이 없으면 ATR 기반 계산.
5. FINAL_DECISION: 최종 방향, 확신도, entry/TP/SL

OUTPUT (JSON only):
{"direction":"long|short|neutral","confidence":0-100,"entry":number,"tp":number,"sl":number,"offense_defense_alignment":"aligned|conflicting|one_side_neutral","rag_adjustment":number,"reasoning":"<100자 한국어>","key_risks":["risk1","risk2"]}`;

  return [
    { role: 'system', content: `You are the Commander — the final decision maker in a multi-agent trading system. You must produce a clear directional call with specific price levels.${SYSTEM_SUFFIX.replace('50 characters', '100 characters')}` },
    { role: 'user', content: prompt },
  ];
}
