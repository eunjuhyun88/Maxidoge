// ═══════════════════════════════════════════════════════════════
// STOCKCLAW — Support / Resistance Level Calculator
// ═══════════════════════════════════════════════════════════════
//
// Pure functions. Detects swing highs/lows from klines,
// clusters nearby levels, and returns nearest S/R to current price.
// Used by C-02 LLM scan to inform Commander TP/SL placement.

import type { BinanceKline } from '$lib/engine/types';
import { calcATR } from '$lib/engine/indicators';

// ─── Types ──────────────────────────────────────────────────

export interface SRLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;       // cluster size (1 = single touch, 2+ = zone)
  timeframe: string;      // '1H' | '4H' | '1D' | '1W' | '1M'
}

// ─── Swing Extreme Detection ────────────────────────────────

/**
 * Find swing highs and swing lows using pivot lookback.
 * A swing high at bar[i] means high[i] >= all highs in [i-lookback, i+lookback].
 * A swing low  at bar[i] means low[i]  <= all lows  in [i-lookback, i+lookback].
 */
export function findSwingExtremes(
  highs: number[],
  lows: number[],
  lookback = 5,
): { swingHighs: number[]; swingLows: number[] } {
  const swingHighs: number[] = [];
  const swingLows: number[] = [];
  const len = Math.min(highs.length, lows.length);

  for (let i = lookback; i < len - lookback; i += 1) {
    const h = highs[i];
    const l = lows[i];
    if (!Number.isFinite(h) || !Number.isFinite(l)) continue;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= lookback; j += 1) {
      if (highs[i - j] > h || highs[i + j] > h) isSwingHigh = false;
      if (lows[i - j] < l || lows[i + j] < l) isSwingLow = false;
      if (!isSwingHigh && !isSwingLow) break;
    }

    if (isSwingHigh) swingHighs.push(h);
    if (isSwingLow) swingLows.push(l);
  }

  return { swingHighs, swingLows };
}

// ─── Level Clustering ───────────────────────────────────────

/**
 * Cluster nearby prices within `threshold` distance.
 * Returns cluster centroids sorted by cluster size (descending),
 * limited to `maxLevels`.
 */
export function clusterLevels(
  prices: number[],
  threshold: number,
  maxLevels = 4,
): Array<{ price: number; strength: number }> {
  if (prices.length === 0 || !Number.isFinite(threshold) || threshold <= 0) return [];

  const sorted = [...prices].filter(Number.isFinite).sort((a, b) => a - b);
  const clusters: Array<{ sum: number; count: number }> = [];

  for (const price of sorted) {
    const existing = clusters.find(
      (c) => Math.abs(c.sum / c.count - price) <= threshold,
    );
    if (existing) {
      existing.sum += price;
      existing.count += 1;
    } else {
      clusters.push({ sum: price, count: 1 });
    }
  }

  return clusters
    .map((c) => ({ price: c.sum / c.count, strength: c.count }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, maxLevels);
}

// ─── S/R from Klines ────────────────────────────────────────

/**
 * Calculate support/resistance levels from klines.
 * Uses swing highs → resistance, swing lows → support.
 * Clusters nearby levels using 0.5 × ATR14 as threshold.
 */
export function calcSRLevels(
  klines: BinanceKline[],
  timeframeLabel: string,
  maxLevels = 3,
): SRLevel[] {
  if (klines.length < 30) return [];

  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);
  const closes = klines.map((k) => k.close);

  // ATR14 for clustering threshold
  const atrArr = calcATR(highs, lows, closes, 14);
  let atr = 0;
  for (let i = atrArr.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(atrArr[i])) { atr = atrArr[i]; break; }
  }
  if (atr <= 0) return [];

  const threshold = atr * 0.5;
  const { swingHighs, swingLows } = findSwingExtremes(highs, lows, 5);

  const resistances = clusterLevels(swingHighs, threshold, maxLevels);
  const supports = clusterLevels(swingLows, threshold, maxLevels);

  const levels: SRLevel[] = [];

  for (const r of resistances) {
    levels.push({
      price: Number(r.price.toFixed(closes[0] >= 100 ? 0 : 4)),
      type: 'resistance',
      strength: Math.min(r.strength, 5),
      timeframe: timeframeLabel,
    });
  }

  for (const s of supports) {
    levels.push({
      price: Number(s.price.toFixed(closes[0] >= 100 ? 0 : 4)),
      type: 'support',
      strength: Math.min(s.strength, 5),
      timeframe: timeframeLabel,
    });
  }

  return levels;
}
