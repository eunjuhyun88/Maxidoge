// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — War Room Scan Engine (v3 extraction)
// ═══════════════════════════════════════════════════════════════

import { fetch24hr, fetchKlines, pairToSymbol, type BinanceKline } from '$lib/api/binance';
import {
  fetchCurrentOI,
  fetchCurrentFunding,
  fetchPredictedFunding,
  fetchLiquidationHistory,
  fetchLSRatioHistory,
  formatFunding,
  formatOI
} from '$lib/api/coinalyze';
import type { AgentSignal } from '$lib/data/warroom';
import { AGENT_POOL } from './agents';
import { fetchFearGreed, fngToScore } from '$lib/api/feargreed';
import { fetchGlobal, btcDominanceToScore } from '$lib/api/coingecko';

type Vote = AgentSignal['vote'];

export type ScanHighlight = {
  agent: string;
  vote: Vote;
  conf: number;
  note: string;
};

export type WarRoomScanResult = {
  pair: string;
  timeframe: string;
  token: string;
  createdAt: number;
  label: string;
  signals: AgentSignal[];
  consensus: Vote;
  avgConfidence: number;
  summary: string;
  highlights: ScanHighlight[];
};

const AGENT_META = {
  structure: { icon: 'STR', name: AGENT_POOL.STRUCTURE.name, color: AGENT_POOL.STRUCTURE.color },
  flow: { icon: 'FLOW', name: AGENT_POOL.FLOW.name, color: AGENT_POOL.FLOW.color },
  deriv: { icon: 'DER', name: AGENT_POOL.DERIV.name, color: AGENT_POOL.DERIV.color },
  senti: { icon: 'SENT', name: AGENT_POOL.SENTI.name, color: AGENT_POOL.SENTI.color },
  macro: { icon: 'MACRO', name: AGENT_POOL.MACRO.name, color: AGENT_POOL.MACRO.color },
  vpa: { icon: 'VPA', name: AGENT_POOL.VPA.name, color: AGENT_POOL.VPA.color },
  ict: { icon: 'ICT', name: AGENT_POOL.ICT.name, color: AGENT_POOL.ICT.color },
  valuation: { icon: 'VAL', name: AGENT_POOL.VALUATION.name, color: AGENT_POOL.VALUATION.color }
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundPrice(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) >= 1000) return Math.round(value);
  if (Math.abs(value) >= 100) return Number(value.toFixed(2));
  return Number(value.toFixed(4));
}

function fmtPrice(price: number): string {
  if (!Number.isFinite(price)) return '$0';
  if (Math.abs(price) >= 1000) return '$' + price.toLocaleString();
  return '$' + price.toFixed(price >= 100 ? 2 : 4);
}

function fmtCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function fmtSignedPct(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '0.00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

function computeSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

function computeRSI(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) avgGain += delta;
    else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeAtrPct(klines: BinanceKline[], period = 14): number | null {
  if (klines.length < period + 1) return null;
  const range = klines.slice(-(period + 1));
  let totalTR = 0;
  for (let i = 1; i < range.length; i++) {
    const prevClose = range[i - 1].close;
    const cur = range[i];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose)
    );
    totalTR += tr;
  }
  const atr = totalTR / period;
  const lastClose = range[range.length - 1].close;
  if (!Number.isFinite(lastClose) || lastClose <= 0) return null;
  return (atr / lastClose) * 100;
}

function scoreToVote(score: number, neutralBand = 0.12): Vote {
  if (score > neutralBand) return 'long';
  if (score < -neutralBand) return 'short';
  return 'neutral';
}

function scoreToConfidence(score: number, base = 58): number {
  const conf = base + Math.abs(score) * 30;
  return Math.round(clamp(conf, 45, 95));
}

function buildTradePlan(entry: number, vote: Vote, score: number, atrPct: number | null) {
  const baseDir = vote === 'neutral' ? (score >= 0 ? 'long' : 'short') : vote;
  const riskPct = atrPct != null ? clamp((atrPct / 100) * 0.9, 0.0035, 0.03) : 0.008;
  const rr = vote === 'neutral' ? 1.35 : 1.8;
  const risk = Math.max(entry * riskPct, entry * 0.0035);
  const sl = baseDir === 'long' ? roundPrice(entry - risk) : roundPrice(entry + risk);
  const tp = baseDir === 'long' ? roundPrice(entry + risk * rr) : roundPrice(entry - risk * rr);
  return { entry: roundPrice(entry), tp, sl };
}

export async function runWarRoomScan(pair: string, timeframe: string): Promise<WarRoomScanResult> {
  const marketPair = pair || 'BTC/USDT';
  const tf = String(timeframe || '4h');
  const token = (marketPair.split('/')[0] || 'BTC').toUpperCase();
  const symbol = pairToSymbol(marketPair);

  const [klinesRes, tickerRes] = await Promise.allSettled([
    fetchKlines(symbol, tf, 240),
    fetch24hr(symbol)
  ]);
  if (klinesRes.status !== 'fulfilled') {
    throw new Error('캔들 데이터 로드에 실패했습니다.');
  }
  const klines = klinesRes.value;
  const ticker = tickerRes.status === 'fulfilled'
    ? tickerRes.value
    : { priceChangePercent: '0', quoteVolume: '0' };

  if (!Array.isArray(klines) || klines.length < 60) {
    throw new Error('캔들 데이터가 부족해서 스캔을 완료할 수 없습니다.');
  }

  const [oiRaw, fundingRaw, predFundingRaw, lsRaw, liqRaw, fngRaw, cgGlobalRaw] = await Promise.allSettled([
    fetchCurrentOI(marketPair),
    fetchCurrentFunding(marketPair),
    fetchPredictedFunding(marketPair),
    fetchLSRatioHistory(marketPair, tf, 24),
    fetchLiquidationHistory(marketPair, tf, 24),
    fetchFearGreed(),
    fetchGlobal()
  ]);

  const now = Date.now();
  const timeLabel = new Date(now).toTimeString().slice(0, 5);
  const scanRunId = `${now}-${Math.floor(Math.random() * 1_000_000).toString(16)}`;
  const latest = klines[klines.length - 1];
  const closes = klines.map((k) => k.close);

  const latestClose = latest.close;
  const latestVolume = latest.volume;
  const avgVolume20 = klines.slice(-20).reduce((sum, k) => sum + k.volume, 0) / Math.max(1, Math.min(20, klines.length));
  const volumeRatio = avgVolume20 > 0 ? latestVolume / avgVolume20 : 1;
  const rsi14 = computeRSI(closes, 14);
  const sma20 = computeSMA(closes, 20);
  const sma60 = computeSMA(closes, 60);
  const sma120 = computeSMA(closes, 120);
  const atrPct = computeAtrPct(klines, 14);

  const change24 = Number(ticker.priceChangePercent || 0);
  const quoteVolume24 = Number(ticker.quoteVolume || 0);
  const oi = oiRaw.status === 'fulfilled' && oiRaw.value ? oiRaw.value.value : null;
  const funding = fundingRaw.status === 'fulfilled' && fundingRaw.value ? fundingRaw.value.value : null;
  const predFunding = predFundingRaw.status === 'fulfilled' && predFundingRaw.value ? predFundingRaw.value.value : null;
  const lsRatio = lsRaw.status === 'fulfilled' && lsRaw.value.length > 0 ? lsRaw.value[lsRaw.value.length - 1].value : null;
  const liqLong = liqRaw.status === 'fulfilled' && liqRaw.value.length > 0
    ? liqRaw.value.reduce((sum, d) => sum + d.long, 0)
    : 0;
  const liqShort = liqRaw.status === 'fulfilled' && liqRaw.value.length > 0
    ? liqRaw.value.reduce((sum, d) => sum + d.short, 0)
    : 0;
  const fng = fngRaw.status === 'fulfilled' ? fngRaw.value : null;
  const cgGlobal = cgGlobalRaw.status === 'fulfilled' ? cgGlobalRaw.value : null;

  let structureScore = 0;
  if (sma20 != null) structureScore += latestClose >= sma20 ? 0.26 : -0.26;
  if (sma60 != null) structureScore += latestClose >= sma60 ? 0.2 : -0.2;
  if (sma120 != null) structureScore += latestClose >= sma120 ? 0.14 : -0.14;
  structureScore += change24 >= 0 ? 0.08 : -0.08;
  if (rsi14 != null) {
    if (rsi14 > 64) structureScore += 0.08;
    else if (rsi14 < 36) structureScore -= 0.08;
  }

  let flowScore = 0;
  if (change24 > 0) flowScore += 0.16;
  else if (change24 < 0) flowScore -= 0.16;
  if (volumeRatio > 1.35) flowScore += change24 >= 0 ? 0.18 : -0.18;
  else if (volumeRatio < 0.85) flowScore -= 0.06;
  if (quoteVolume24 > 1_000_000_000) flowScore += 0.06;
  else if (quoteVolume24 < 120_000_000) flowScore -= 0.04;

  let derivScore = 0;
  let derivDataPoints = 0;
  if (funding != null) {
    derivDataPoints++;
    if (funding > 0.0006) derivScore -= 0.24;
    else if (funding < -0.0006) derivScore += 0.24;
  }
  if (predFunding != null) {
    derivDataPoints++;
    if (predFunding > 0.0006) derivScore -= 0.12;
    else if (predFunding < -0.0006) derivScore += 0.12;
  }
  if (lsRatio != null) {
    derivDataPoints++;
    if (lsRatio > 1.12) derivScore -= 0.17;
    else if (lsRatio < 0.9) derivScore += 0.17;
  }
  if (liqLong > 0 || liqShort > 0) {
    derivDataPoints++;
    const liqBias = (liqShort - liqLong) / Math.max(liqShort + liqLong, 1);
    derivScore += liqBias * 0.22;
  }

  let sentiScore = 0;
  if (fng) {
    // Real Fear & Greed data — contrarian scoring
    const fngScoreVal = fngToScore(fng.value);
    sentiScore += (fngScoreVal / 100) * 0.35;
  } else {
    // Fallback: price momentum proxy
    if (change24 >= 2.0) sentiScore += 0.22;
    else if (change24 <= -2.0) sentiScore -= 0.22;
    else sentiScore += change24 / 15;
  }
  if (rsi14 != null) {
    if (rsi14 > 62) sentiScore += 0.12;
    else if (rsi14 < 38) sentiScore -= 0.12;
  }
  if (funding != null) {
    if (funding > 0.0007) sentiScore -= 0.08;
    else if (funding < -0.0007) sentiScore += 0.08;
  }

  let macroScore = 0;
  if (cgGlobal) {
    // Real CoinGecko global data
    const domScore = btcDominanceToScore(cgGlobal.btcDominance);
    macroScore += (domScore / 100) * 0.16;
    if (cgGlobal.marketCapChange24h > 2) macroScore += 0.12;
    else if (cgGlobal.marketCapChange24h < -2) macroScore -= 0.12;
    else macroScore += cgGlobal.marketCapChange24h / 25;
  }
  if (sma120 != null) macroScore += latestClose >= sma120 ? 0.14 : -0.14;
  if (Math.abs(change24) > 4) macroScore += change24 > 0 ? 0.1 : -0.1;
  if (funding != null && change24 > 0 && funding > 0.0006) macroScore -= 0.12;
  if (funding != null && change24 < 0 && funding < -0.0006) macroScore += 0.12;
  if (atrPct != null && atrPct > 4) macroScore += change24 > 0 ? -0.08 : 0.08;
  if (lsRatio != null) {
    if (lsRatio > 1.15) macroScore -= 0.08;
    if (lsRatio < 0.88) macroScore += 0.08;
  }

  // ── VPA Agent (Volume Price Analysis) ──
  const recentK20 = klines.slice(-20);
  const cvd = recentK20.reduce((sum, k) => sum + (k.close >= k.open ? k.volume : -k.volume), 0);
  const totalVol20 = recentK20.reduce((sum, k) => sum + k.volume, 0);
  const cvdRatio = totalVol20 > 0 ? cvd / totalVol20 : 0;
  const buyVol = recentK20.filter(k => k.close >= k.open).reduce((s, k) => s + k.volume, 0);
  const sellVol = recentK20.filter(k => k.close < k.open).reduce((s, k) => s + k.volume, 0);
  const bsRatio = (buyVol + sellVol) > 0 ? buyVol / (buyVol + sellVol) : 0.5;
  const last5 = klines.slice(-5);
  let absorptionCount = 0;
  for (const k of last5) {
    const body = Math.abs(k.close - k.open);
    const range = k.high - k.low;
    if (range > 0 && body / range < 0.3 && k.volume > avgVolume20 * 1.2) absorptionCount++;
  }
  let vpaScore = 0;
  vpaScore += cvdRatio * 0.4;
  vpaScore += (bsRatio - 0.5) * 0.6;
  if (absorptionCount >= 2) vpaScore += latestClose < (sma20 ?? latestClose) ? 0.15 : -0.15;

  // ── ICT Agent (Smart Money Concepts) ──
  const high50 = Math.max(...klines.slice(-50).map(k => k.high));
  const low50 = Math.min(...klines.slice(-50).map(k => k.low));
  const range50 = high50 - low50;
  const pricePosition = range50 > 0 ? (latestClose - low50) / range50 : 0.5;
  const recentHigh = Math.max(...klines.slice(-10).map(k => k.high));
  const prevHigh = Math.max(...klines.slice(-20, -10).map(k => k.high));
  const recentLow = Math.min(...klines.slice(-10).map(k => k.low));
  const prevLow = Math.min(...klines.slice(-20, -10).map(k => k.low));
  let bullFVG = 0, bearFVG = 0;
  for (let i = klines.length - 3; i >= Math.max(klines.length - 12, 2); i--) {
    if (klines[i].low > klines[i - 2].high) bullFVG++;
    if (klines[i].high < klines[i - 2].low) bearFVG++;
  }
  let ictScore = 0;
  ictScore += (0.5 - pricePosition) * 0.4;
  if (recentHigh > prevHigh) ictScore += 0.15;
  if (recentLow < prevLow) ictScore -= 0.15;
  ictScore += (bullFVG - bearFVG) * 0.08;
  const last3 = klines.slice(-3);
  for (const k of last3) {
    const body = Math.abs(k.close - k.open);
    const range = k.high - k.low;
    if (range > 0 && body / range > 0.7) ictScore += k.close > k.open ? 0.06 : -0.06;
  }

  // ── VALUATION Agent (On-chain Valuation Proxy) ──
  let valuationScore = 0;
  if (sma120 != null) {
    const deviation = (latestClose - sma120) / sma120;
    if (deviation > 0.15) valuationScore -= 0.25;
    else if (deviation < -0.15) valuationScore += 0.25;
    else valuationScore += -deviation * 1.2;
  }
  if (rsi14 != null) {
    if (rsi14 > 70) valuationScore -= 0.2;
    else if (rsi14 < 30) valuationScore += 0.2;
    else valuationScore += (50 - rsi14) / 150;
  }
  if (volumeRatio > 1.5 && change24 < -1) valuationScore += 0.12;
  if (volumeRatio > 1.5 && change24 > 3) valuationScore -= 0.12;
  if (cgGlobal) {
    if (cgGlobal.marketCapChange24h < -5) valuationScore += 0.1;
    if (cgGlobal.marketCapChange24h > 5) valuationScore -= 0.1;
  }

  const structureVote = scoreToVote(structureScore, 0.1);
  const flowVote = scoreToVote(flowScore, 0.08);
  const derivVote = derivDataPoints === 0 ? 'neutral' : scoreToVote(derivScore, 0.1);
  const sentiVote = scoreToVote(sentiScore, 0.08);
  const macroVote = scoreToVote(macroScore, 0.1);
  const vpaVote = scoreToVote(vpaScore, 0.08);
  const ictVote = scoreToVote(ictScore, 0.1);
  const valuationVote = scoreToVote(valuationScore, 0.1);

  const structurePlan = buildTradePlan(latestClose, structureVote, structureScore, atrPct);
  const flowPlan = buildTradePlan(latestClose, flowVote, flowScore, atrPct);
  const derivPlan = buildTradePlan(latestClose, derivVote, derivScore, atrPct);
  const sentiPlan = buildTradePlan(latestClose, sentiVote, sentiScore, atrPct);
  const macroPlan = buildTradePlan(latestClose, macroVote, macroScore, atrPct);
  const vpaPlan = buildTradePlan(latestClose, vpaVote, vpaScore, atrPct);
  const ictPlan = buildTradePlan(latestClose, ictVote, ictScore, atrPct);
  const valuationPlan = buildTradePlan(latestClose, valuationVote, valuationScore, atrPct);

  const signals: AgentSignal[] = [
    {
      id: `structure-${scanRunId}`,
      agentId: 'structure',
      icon: AGENT_META.structure.icon,
      name: AGENT_META.structure.name,
      color: AGENT_META.structure.color,
      token,
      pair: marketPair,
      vote: structureVote,
      conf: scoreToConfidence(structureScore, 60),
      text: `Price ${fmtPrice(latestClose)} · MA20 ${sma20 != null ? fmtPrice(sma20) : '—'} · MA60 ${sma60 != null ? fmtPrice(sma60) : '—'} · RSI ${rsi14 != null ? rsi14.toFixed(1) : '—'} · 24h ${fmtSignedPct(change24)}.`,
      src: `BINANCE:${token}:${tf.toUpperCase()}`,
      time: timeLabel,
      entry: structurePlan.entry,
      tp: structurePlan.tp,
      sl: structurePlan.sl
    },
    {
      id: `flow-${scanRunId}`,
      agentId: 'flow',
      icon: AGENT_META.flow.icon,
      name: AGENT_META.flow.name,
      color: AGENT_META.flow.color,
      token,
      pair: marketPair,
      vote: flowVote,
      conf: scoreToConfidence(flowScore, 56),
      text: `Volume x${volumeRatio.toFixed(2)} vs 20-bar avg · 24h quote volume $${fmtCompact(quoteVolume24)} · momentum ${fmtSignedPct(change24)}.`,
      src: 'BINANCE:VOLUME/FLOW',
      time: timeLabel,
      entry: flowPlan.entry,
      tp: flowPlan.tp,
      sl: flowPlan.sl
    },
    {
      id: `deriv-${scanRunId}`,
      agentId: 'deriv',
      icon: AGENT_META.deriv.icon,
      name: AGENT_META.deriv.name,
      color: AGENT_META.deriv.color,
      token,
      pair: marketPair,
      vote: derivVote,
      conf: derivDataPoints === 0 ? 48 : scoreToConfidence(derivScore, 58),
      text: derivDataPoints === 0
        ? 'Derivatives API unavailable. Fallback to neutral stance until funding/OI stream recovers.'
        : `OI ${oi != null ? formatOI(oi) : '—'} · Funding ${funding != null ? formatFunding(funding) : '—'} · Pred ${predFunding != null ? formatFunding(predFunding) : '—'} · L/S ${lsRatio != null ? lsRatio.toFixed(2) : '—'} · Liq L ${formatOI(liqLong)} / S ${formatOI(liqShort)}.`,
      src: 'COINALYZE:PERP',
      time: timeLabel,
      entry: derivPlan.entry,
      tp: derivPlan.tp,
      sl: derivPlan.sl
    },
    {
      id: `senti-${scanRunId}`,
      agentId: 'senti',
      icon: AGENT_META.senti.icon,
      name: AGENT_META.senti.name,
      color: AGENT_META.senti.color,
      token,
      pair: marketPair,
      vote: sentiVote,
      conf: scoreToConfidence(sentiScore, 54),
      text: fng
        ? `F&G ${fng.value} ${fng.classification} · 24h ${fmtSignedPct(change24)} · RSI ${rsi14 != null ? rsi14.toFixed(1) : '—'} · volume x${volumeRatio.toFixed(2)}.`
        : `Sentiment proxy · 24h ${fmtSignedPct(change24)} · RSI ${rsi14 != null ? rsi14.toFixed(1) : '—'} · volume x${volumeRatio.toFixed(2)}.`,
      src: fng ? 'ALTERNATIVE.ME:F&G' : 'PROXY:PRICE/MOMENTUM',
      time: timeLabel,
      entry: sentiPlan.entry,
      tp: sentiPlan.tp,
      sl: sentiPlan.sl
    },
    {
      id: `macro-${scanRunId}`,
      agentId: 'macro',
      icon: AGENT_META.macro.icon,
      name: AGENT_META.macro.name,
      color: AGENT_META.macro.color,
      token,
      pair: marketPair,
      vote: macroVote,
      conf: scoreToConfidence(macroScore, 57),
      text: cgGlobal
        ? `BTC Dom ${cgGlobal.btcDominance.toFixed(1)}% · MktCap 24h ${fmtSignedPct(cgGlobal.marketCapChange24h)} · trend ${sma120 != null ? (latestClose >= sma120 ? 'risk-on' : 'risk-off') : 'unknown'} · funding ${funding != null ? formatFunding(funding) : '—'} · vol ${atrPct != null ? atrPct.toFixed(2) : '—'}%.`
        : `Macro regime proxy · trend ${sma120 != null ? (latestClose >= sma120 ? 'risk-on' : 'risk-off') : 'unknown'} · funding ${funding != null ? formatFunding(funding) : '—'} · volatility ${atrPct != null ? atrPct.toFixed(2) : '—'}%.`,
      src: cgGlobal ? 'COINGECKO:GLOBAL' : 'MACRO:REGIME',
      time: timeLabel,
      entry: macroPlan.entry,
      tp: macroPlan.tp,
      sl: macroPlan.sl
    },
    {
      id: `vpa-${scanRunId}`,
      agentId: 'vpa',
      icon: AGENT_META.vpa.icon,
      name: AGENT_META.vpa.name,
      color: AGENT_META.vpa.color,
      token,
      pair: marketPair,
      vote: vpaVote,
      conf: scoreToConfidence(vpaScore, 56),
      text: `CVD ${cvdRatio > 0 ? 'bullish' : 'bearish'} ${fmtSignedPct(cvdRatio * 100)} · Buy vol ${(bsRatio * 100).toFixed(0)}% · Vol x${volumeRatio.toFixed(2)} · ${absorptionCount >= 2 ? 'Absorption detected' : 'No absorption'}.`,
      src: `BINANCE:${token}:VOLUME`,
      time: timeLabel,
      entry: vpaPlan.entry,
      tp: vpaPlan.tp,
      sl: vpaPlan.sl
    },
    {
      id: `ict-${scanRunId}`,
      agentId: 'ict',
      icon: AGENT_META.ict.icon,
      name: AGENT_META.ict.name,
      color: AGENT_META.ict.color,
      token,
      pair: marketPair,
      vote: ictVote,
      conf: scoreToConfidence(ictScore, 55),
      text: `${pricePosition > 0.5 ? 'Premium' : 'Discount'} zone ${(pricePosition * 100).toFixed(0)}% · ${recentHigh > prevHigh ? 'Bullish BOS' : recentLow < prevLow ? 'Bearish BOS' : 'No BOS'} · FVG bull ${bullFVG} / bear ${bearFVG} · Range ${fmtPrice(low50)}-${fmtPrice(high50)}.`,
      src: `BINANCE:${token}:ICT`,
      time: timeLabel,
      entry: ictPlan.entry,
      tp: ictPlan.tp,
      sl: ictPlan.sl
    },
    {
      id: `valuation-${scanRunId}`,
      agentId: 'valuation',
      icon: AGENT_META.valuation.icon,
      name: AGENT_META.valuation.name,
      color: AGENT_META.valuation.color,
      token,
      pair: marketPair,
      vote: valuationVote,
      conf: scoreToConfidence(valuationScore, 54),
      text: `${sma120 != null ? `MA120 dev ${fmtSignedPct(((latestClose - sma120) / sma120) * 100)}` : 'MA120 —'} · RSI ${rsi14 != null ? rsi14.toFixed(1) : '—'} · Vol regime x${volumeRatio.toFixed(2)}${cgGlobal ? ` · MktCap ${fmtSignedPct(cgGlobal.marketCapChange24h)}` : ''}.`,
      src: cgGlobal ? 'COINGECKO:VALUATION' : 'PROXY:VALUATION',
      time: timeLabel,
      entry: valuationPlan.entry,
      tp: valuationPlan.tp,
      sl: valuationPlan.sl
    }
  ];

  const avgConfidence = Math.round(signals.reduce((sum, sig) => sum + sig.conf, 0) / Math.max(signals.length, 1));
  const voteCounts = signals.reduce((acc, sig) => {
    acc[sig.vote] += 1;
    return acc;
  }, { long: 0, short: 0, neutral: 0 });
  const consensus: Vote =
    voteCounts.long > voteCounts.short && voteCounts.long > voteCounts.neutral
      ? 'long'
      : voteCounts.short > voteCounts.long && voteCounts.short > voteCounts.neutral
        ? 'short'
        : 'neutral';
  const summary =
    `Consensus ${consensus.toUpperCase()} · Avg CONF ${avgConfidence}% · ` +
    `RSI ${rsi14 != null ? rsi14.toFixed(1) : '—'} · 24h ${fmtSignedPct(change24)} · Vol x${volumeRatio.toFixed(2)}`;
  const highlights: ScanHighlight[] = signals.map((sig) => ({
    agent: sig.name,
    vote: sig.vote,
    conf: sig.conf,
    note: sig.text
  }));

  return {
    pair: marketPair,
    timeframe: tf,
    token,
    createdAt: now,
    label: timeLabel,
    signals,
    consensus,
    avgConfidence,
    summary,
    highlights
  };
}
