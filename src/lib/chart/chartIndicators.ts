// ═══ Chart Indicator Computation ═══
// Extracted from ChartPanel.svelte for reuse and testability

import type { IndicatorKey } from '$lib/chart/chartTypes';

export type { IndicatorKey };

export type IndicatorProfile = Record<IndicatorKey, boolean>;

export const INDICATOR_PROFILES = {
  basic: { ma20: false, ma60: false, ma120: false, ma7: true, ma25: true, ma99: true, rsi: true, vol: true, bb: false, macd: false, stoch: false, oi: false, funding: false, liq: false } as IndicatorProfile,
  advancedFocus: { ma20: true, ma60: true, ma120: true, ma7: false, ma25: false, ma99: false, rsi: true, vol: true, bb: false, macd: false, stoch: false, oi: false, funding: false, liq: false } as IndicatorProfile,
  advancedFull: { ma20: true, ma60: true, ma120: true, ma7: true, ma25: true, ma99: true, rsi: true, vol: true, bb: false, macd: false, stoch: false, oi: false, funding: false, liq: false } as IndicatorProfile,
} as const;

export function getIndicatorProfile(advancedMode: boolean, chartVisualMode: 'focus' | 'full'): IndicatorProfile {
  if (!advancedMode) return INDICATOR_PROFILES.basic;
  return chartVisualMode === 'full' ? INDICATOR_PROFILES.advancedFull : INDICATOR_PROFILES.advancedFocus;
}

export function computeSMA(
  data: { time: unknown; close: number }[],
  period: number
): { time: unknown; value: number }[] {
  const result: { time: unknown; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

export interface RSIState {
  avgGain: number;
  avgLoss: number;
}

export function computeRSI(
  data: { time: unknown; close: number }[],
  period = 14
): { result: { time: unknown; value: number }[]; state: RSIState } {
  if (data.length < period + 1) return { result: [], state: { avgGain: 0, avgLoss: 0 } };
  const result: { time: unknown; value: number }[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = data[i].close - data[i - 1].close;
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push({ time: data[period].time, value: rsi });
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i].close - data[i - 1].close;
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    result.push({
      time: data[i].time,
      value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
    });
  }
  return { result, state: { avgGain, avgLoss } };
}

/** Incremental RSI update for a single new candle (Wilder smoothing) */
export function updateRSIIncremental(
  state: RSIState,
  delta: number,
  period = 14
): { value: number; state: RSIState } {
  const avgGain = (state.avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period;
  const avgLoss = (state.avgLoss * (period - 1) + (delta < 0 ? -delta : 0)) / period;
  const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  return { value, state: { avgGain, avgLoss } };
}

// ═══ EMA (Exponential Moving Average) ═══

export function computeEMA(
  data: { time: unknown; close: number }[],
  period: number,
): { time: unknown; value: number }[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: { time: unknown; value: number }[] = [];
  // Seed with SMA of first `period` candles
  let ema = 0;
  if (data.length < period) return [];
  for (let i = 0; i < period; i++) ema += data[i].close;
  ema /= period;
  result.push({ time: data[period - 1].time, value: ema });
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

export interface EMAState {
  value: number;
}

/** Incremental EMA update for a single new close */
export function updateEMAIncremental(
  state: EMAState,
  close: number,
  period: number,
): { value: number; state: EMAState } {
  const k = 2 / (period + 1);
  const value = close * k + state.value * (1 - k);
  return { value, state: { value } };
}

// ═══ Bollinger Bands ═══

export interface BBPoint {
  time: unknown;
  upper: number;
  middle: number;
  lower: number;
}

export function computeBB(
  data: { time: unknown; close: number }[],
  period = 20,
  mult = 2,
): BBPoint[] {
  const result: BBPoint[] = [];
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;

  for (let i = period - 1; i < data.length; i++) {
    if (i >= period) {
      sum += data[i].close - data[i - period].close;
    }
    const mean = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j].close - mean;
      sqSum += diff * diff;
    }
    const stdDev = Math.sqrt(sqSum / period);
    result.push({
      time: data[i].time,
      upper: mean + mult * stdDev,
      middle: mean,
      lower: mean - mult * stdDev,
    });
  }
  return result;
}

// ═══ MACD ═══

export interface MACDPoint {
  time: unknown;
  macd: number;
  signal: number;
  histogram: number;
}

export function computeMACD(
  data: { time: unknown; close: number }[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MACDPoint[] {
  if (data.length < slow) return [];

  // Compute fast and slow EMA values
  const fastK = 2 / (fast + 1);
  const slowK = 2 / (slow + 1);

  // Seed fast EMA
  let fastEMA = 0;
  for (let i = 0; i < fast; i++) fastEMA += data[i].close;
  fastEMA /= fast;
  for (let i = fast; i < slow - 1; i++) {
    fastEMA = data[i].close * fastK + fastEMA * (1 - fastK);
  }

  // Seed slow EMA
  let slowEMA = 0;
  for (let i = 0; i < slow; i++) slowEMA += data[i].close;
  slowEMA /= slow;

  // Compute MACD line from slow-1 onward
  const macdLine: { time: unknown; value: number }[] = [];
  fastEMA = data[slow - 1].close * fastK + fastEMA * (1 - fastK);
  const firstMacd = fastEMA - slowEMA;
  macdLine.push({ time: data[slow - 1].time, value: firstMacd });

  for (let i = slow; i < data.length; i++) {
    fastEMA = data[i].close * fastK + fastEMA * (1 - fastK);
    slowEMA = data[i].close * slowK + slowEMA * (1 - slowK);
    macdLine.push({ time: data[i].time, value: fastEMA - slowEMA });
  }

  // Signal line = EMA of MACD line
  if (macdLine.length < signalPeriod) {
    return macdLine.map((m) => ({
      time: m.time,
      macd: m.value,
      signal: 0,
      histogram: m.value,
    }));
  }

  const sigK = 2 / (signalPeriod + 1);
  let sigEMA = 0;
  for (let i = 0; i < signalPeriod; i++) sigEMA += macdLine[i].value;
  sigEMA /= signalPeriod;

  const result: MACDPoint[] = [];
  // Pre-signal points
  for (let i = 0; i < signalPeriod - 1; i++) {
    result.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal: 0,
      histogram: macdLine[i].value,
    });
  }
  // Signal starts
  result.push({
    time: macdLine[signalPeriod - 1].time,
    macd: macdLine[signalPeriod - 1].value,
    signal: sigEMA,
    histogram: macdLine[signalPeriod - 1].value - sigEMA,
  });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    sigEMA = macdLine[i].value * sigK + sigEMA * (1 - sigK);
    result.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal: sigEMA,
      histogram: macdLine[i].value - sigEMA,
    });
  }
  return result;
}

// ═══ Stochastic Oscillator ═══

export interface StochasticPoint {
  time: unknown;
  k: number;
  d: number;
}

export function computeStochastic(
  data: { time: unknown; high: number; low: number; close: number }[],
  kPeriod = 14,
  dPeriod = 3,
  smooth = 3,
): StochasticPoint[] {
  if (data.length < kPeriod) return [];

  // Raw %K
  const rawK: number[] = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    let high = -Infinity;
    let low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].high > high) high = data[j].high;
      if (data[j].low < low) low = data[j].low;
    }
    const range = high - low;
    rawK.push(range > 0 ? ((data[i].close - low) / range) * 100 : 50);
  }

  // Smoothed %K (SMA of rawK with period=smooth)
  const smoothedK: number[] = [];
  if (rawK.length < smooth) return [];
  let kSum = 0;
  for (let i = 0; i < smooth; i++) kSum += rawK[i];
  smoothedK.push(kSum / smooth);
  for (let i = smooth; i < rawK.length; i++) {
    kSum += rawK[i] - rawK[i - smooth];
    smoothedK.push(kSum / smooth);
  }

  // %D = SMA of smoothed %K with period=dPeriod
  if (smoothedK.length < dPeriod) return [];
  const result: StochasticPoint[] = [];
  let dSum = 0;
  for (let i = 0; i < dPeriod; i++) dSum += smoothedK[i];
  // Pre-D points
  for (let i = 0; i < dPeriod - 1; i++) {
    const dataIdx = kPeriod - 1 + smooth - 1 + i;
    if (dataIdx < data.length) {
      result.push({ time: data[dataIdx].time, k: smoothedK[i], d: 0 });
    }
  }
  // D starts
  const dStartDataIdx = kPeriod - 1 + smooth - 1 + dPeriod - 1;
  if (dStartDataIdx < data.length) {
    result.push({
      time: data[dStartDataIdx].time,
      k: smoothedK[dPeriod - 1],
      d: dSum / dPeriod,
    });
  }
  for (let i = dPeriod; i < smoothedK.length; i++) {
    dSum += smoothedK[i] - smoothedK[i - dPeriod];
    const dataIdx = kPeriod - 1 + smooth - 1 + i;
    if (dataIdx < data.length) {
      result.push({
        time: data[dataIdx].time,
        k: smoothedK[i],
        d: dSum / dPeriod,
      });
    }
  }
  return result;
}

export const BAR_SPACING = {
  MIN: 5,
  MAX: 28,
  STEP: 1.5,
  DEFAULT: 14,
} as const;

export const MAX_KLINE_CACHE = 5000;
export const MAX_DRAWINGS = 50;
export const LINE_ENTRY_DEFAULT_RR = 2;
export const LINE_ENTRY_MIN_PIXEL_RISK = 6;
export const MIN_PATTERN_CANDLES = 30;
export const MAX_OVERLAY_PATTERNS = 1;

// ═══ Server-side helper (single-value, O(period) — no time metadata) ═══

/** Last SMA value from plain closes, or null if insufficient data */
export function smaLast(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}
// For full SMA/RSI series from plain closes, use calcSMA/calcRSI from $lib/engine/indicators
