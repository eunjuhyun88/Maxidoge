// ═══════════════════════════════════════════════════════════════
// MAXI⚡DOGE — Chart Pattern Detector (MVP)
// ═══════════════════════════════════════════════════════════════

import type { BinanceKline } from './types';

export type ChartPatternKind = 'head_and_shoulders' | 'falling_wedge';
export type ChartPatternDirection = 'BULLISH' | 'BEARISH';
export type ChartPatternStatus = 'FORMING' | 'CONFIRMED';

export interface ChartPatternLine {
  id: string;
  label: string;
  color: string;
  style: 'solid' | 'dashed';
  from: { time: number; price: number };
  to: { time: number; price: number };
}

export interface ChartPatternDetection {
  id: string;
  kind: ChartPatternKind;
  name: string;
  shortName: string;
  direction: ChartPatternDirection;
  status: ChartPatternStatus;
  confidence: number; // 0.0 ~ 1.0
  startTime: number;
  endTime: number;
  markerTime: number;
  markerPrice: number;
  guideLines: ChartPatternLine[];
}

export interface ChartPatternOptions {
  maxPatterns?: number;
  pivotLookaround?: number;
}

type Pivot = {
  index: number;
  time: number;
  price: number;
  kind: 'high' | 'low';
};

const HS_LOOKBACK_BARS = 220;
const HS_MIN_BAR_GAP = 3;
const HS_SIDE_SEARCH = 3;
const HS_MAX_SHOULDER_DIFF = 0.06;
const HS_MIN_HEAD_LIFT = 0.009;
const HS_MIN_VALLEY_DEPTH = 0.01;
const HS_BREAK_BUFFER = 0.002;
const HS_BREAK_MAX_BARS = 48;

const WEDGE_WINDOWS = [36, 48, 60];
const WEDGE_MIN_POINTS = 3;
const WEDGE_MIN_CONTRACTION = 0.25;
const WEDGE_SLOPE_RATIO = 1.12;
const WEDGE_BREAK_BUFFER = 0.0015;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isFiniteNum(value: number): boolean {
  return Number.isFinite(value);
}

function collectPivots(klines: BinanceKline[], lookaround: number): { highs: Pivot[]; lows: Pivot[] } {
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  if (klines.length < lookaround * 2 + 1) return { highs, lows };

  for (let i = lookaround; i < klines.length - lookaround; i += 1) {
    const curr = klines[i];
    if (!curr) continue;

    let isHigh = true;
    let isLow = true;
    for (let j = i - lookaround; j <= i + lookaround; j += 1) {
      if (j === i) continue;
      const other = klines[j];
      if (!other) continue;
      if (curr.high <= other.high) isHigh = false;
      if (curr.low >= other.low) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) highs.push({ index: i, time: curr.time, price: curr.high, kind: 'high' });
    if (isLow) lows.push({ index: i, time: curr.time, price: curr.low, kind: 'low' });
  }

  return { highs, lows };
}

function findLowestBetween(lows: Pivot[], startIndex: number, endIndex: number): Pivot | null {
  let best: Pivot | null = null;
  for (const low of lows) {
    if (low.index <= startIndex || low.index >= endIndex) continue;
    if (!best || low.price < best.price) best = low;
  }
  return best;
}

function lineValueAtIndex(a: Pivot, b: Pivot, index: number): number {
  if (a.index === b.index) return a.price;
  const slope = (b.price - a.price) / (b.index - a.index);
  return a.price + slope * (index - a.index);
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function linearRegression(points: Array<{ x: number; y: number }>): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXX += p.x * p.x;
    sumXY += p.x * p.y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: 0, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  let ssTot = 0;
  let ssRes = 0;
  const meanY = sumY / n;
  for (const p of points) {
    const fit = slope * p.x + intercept;
    ssRes += (p.y - fit) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : clamp(1 - ssRes / ssTot, 0, 1);
  return { slope, intercept, r2 };
}

function detectHeadAndShoulders(klines: BinanceKline[], lookaround: number): ChartPatternDetection | null {
  if (klines.length < 40) return null;

  const { highs, lows } = collectPivots(klines, lookaround);
  if (highs.length < 3 || lows.length < 2) return null;

  let best: ChartPatternDetection | null = null;
  const minRecentIndex = Math.max(0, klines.length - HS_LOOKBACK_BARS);

  for (let i = 1; i < highs.length - 1; i += 1) {
    const h2 = highs[i];
    const leftStart = Math.max(0, i - HS_SIDE_SEARCH);
    const rightEnd = Math.min(highs.length - 1, i + HS_SIDE_SEARCH);

    for (let li = leftStart; li < i; li += 1) {
      const h1 = highs[li];

      for (let ri = i + 1; ri <= rightEnd; ri += 1) {
        const h3 = highs[ri];

        if (h3.index < minRecentIndex) continue;
        if (h2.index - h1.index < HS_MIN_BAR_GAP) continue;
        if (h3.index - h2.index < HS_MIN_BAR_GAP) continue;

        const shoulderBase = Math.max(h1.price, h3.price);
        if (!isFiniteNum(shoulderBase) || shoulderBase <= 0) continue;

        const shoulderDiff = Math.abs(h1.price - h3.price) / shoulderBase;
        if (shoulderDiff > HS_MAX_SHOULDER_DIFF) continue;

        const headLift = (h2.price - shoulderBase) / shoulderBase;
        if (headLift < HS_MIN_HEAD_LIFT) continue;

        const l1 = findLowestBetween(lows, h1.index, h2.index);
        const l2 = findLowestBetween(lows, h2.index, h3.index);
        if (!l1 || !l2) continue;

        const valleyDepth = (h2.price - Math.min(l1.price, l2.price)) / Math.max(h2.price, 1);
        if (valleyDepth < HS_MIN_VALLEY_DEPTH) continue;

        let breakoutIndex = -1;
        for (let k = h3.index + 1; k < Math.min(klines.length, h3.index + HS_BREAK_MAX_BARS); k += 1) {
          const neck = lineValueAtIndex(l1, l2, k);
          if (!isFiniteNum(neck) || neck <= 0) continue;
          if (klines[k].close < neck * (1 - HS_BREAK_BUFFER)) {
            breakoutIndex = k;
            break;
          }
        }

        const markerIndex = breakoutIndex >= 0 ? breakoutIndex : h3.index;
        const markerKline = klines[markerIndex];
        const markerNeck = lineValueAtIndex(l1, l2, markerIndex);
        if (!isFiniteNum(markerNeck) || markerNeck <= 0) continue;

        const breakoutDepth = breakoutIndex >= 0 ? (markerNeck - markerKline.close) / markerNeck : 0;
        const shoulderScore = 1 - clamp(shoulderDiff / HS_MAX_SHOULDER_DIFF, 0, 1);
        const headScore = clamp(headLift / 0.04, 0, 1);
        const valleyScore = clamp(valleyDepth / 0.1, 0, 1);
        const breakScore = breakoutIndex >= 0 ? clamp(breakoutDepth / 0.012, 0, 1) : 0.35;
        const confidence = clamp(
          0.2 + shoulderScore * 0.28 + headScore * 0.27 + valleyScore * 0.2 + breakScore * 0.25,
          0.25,
          0.96
        );
        const status: ChartPatternStatus = breakoutIndex >= 0 ? 'CONFIRMED' : 'FORMING';

        const detection: ChartPatternDetection = {
          id: `hs-${h1.time}-${h2.time}-${h3.time}-${markerKline.time}`,
          kind: 'head_and_shoulders',
          name: 'Head and Shoulders',
          shortName: 'H&S',
          direction: 'BEARISH',
          status,
          confidence,
          startTime: h1.time,
          endTime: markerKline.time,
          markerTime: markerKline.time,
          markerPrice: markerKline.high,
          guideLines: [
            {
              id: `hs-neck-${h1.time}-${h3.time}`,
              label: 'neckline',
              color: '#ff657a',
              style: 'dashed',
              from: { time: l1.time, price: l1.price },
              to: { time: markerKline.time, price: markerNeck },
            },
            {
              id: `hs-crest-l-${h1.time}-${h2.time}`,
              label: 'crest-left',
              color: '#ff8ca0',
              style: 'solid',
              from: { time: h1.time, price: h1.price },
              to: { time: h2.time, price: h2.price },
            },
            {
              id: `hs-crest-r-${h2.time}-${h3.time}`,
              label: 'crest-right',
              color: '#ff8ca0',
              style: 'solid',
              from: { time: h2.time, price: h2.price },
              to: { time: h3.time, price: h3.price },
            },
          ],
        };

        if (!best) {
          best = detection;
          continue;
        }
        if (detection.status === 'CONFIRMED' && best.status !== 'CONFIRMED') {
          best = detection;
          continue;
        }
        if (detection.endTime > best.endTime) best = detection;
        else if (detection.endTime === best.endTime && detection.confidence > best.confidence) best = detection;
      }
    }
  }

  return best;
}

function detectFallingWedge(klines: BinanceKline[], lookaround: number): ChartPatternDetection | null {
  if (klines.length < 48) return null;

  let best: ChartPatternDetection | null = null;
  for (const windowSize of WEDGE_WINDOWS) {
    if (klines.length < windowSize) continue;
    const start = klines.length - windowSize;
    const end = klines.length - 1;
    const window = klines.slice(start);
    const { highs, lows } = collectPivots(window, lookaround);
    if (highs.length < WEDGE_MIN_POINTS || lows.length < WEDGE_MIN_POINTS) continue;

    const highPoints = highs.map((p) => ({ x: start + p.index, y: p.price }));
    const lowPoints = lows.map((p) => ({ x: start + p.index, y: p.price }));
    const upReg = linearRegression(highPoints);
    const lowReg = linearRegression(lowPoints);

    if (!(upReg.slope < 0 && lowReg.slope < 0)) continue;
    if (!(Math.abs(upReg.slope) > Math.abs(lowReg.slope) * WEDGE_SLOPE_RATIO)) continue;

    const upperAt = (idx: number) => upReg.slope * idx + upReg.intercept;
    const lowerAt = (idx: number) => lowReg.slope * idx + lowReg.intercept;

    const widthStart = upperAt(start) - lowerAt(start);
    const widthEnd = upperAt(end) - lowerAt(end);
    if (!isFiniteNum(widthStart) || !isFiniteNum(widthEnd)) continue;
    if (widthStart <= 0 || widthEnd <= 0) continue;

    const contraction = 1 - widthEnd / widthStart;
    if (contraction < WEDGE_MIN_CONTRACTION) continue;

    let breakoutIndex = -1;
    const probeStart = Math.max(start + Math.floor(windowSize * 0.55), klines.length - 12);
    for (let i = probeStart; i <= end; i += 1) {
      const upper = upperAt(i);
      if (!isFiniteNum(upper) || upper <= 0) continue;
      const close = klines[i].close;
      if (close > upper * (1 + WEDGE_BREAK_BUFFER)) {
        breakoutIndex = i;
        break;
      }
    }

    const markerIndex = breakoutIndex >= 0 ? breakoutIndex : end;
    const marker = klines[markerIndex];
    const lineFit = clamp((upReg.r2 + lowReg.r2) / 2, 0, 1);
    const slopeGap = clamp((Math.abs(upReg.slope) / Math.max(Math.abs(lowReg.slope), 1e-9) - 1) / 0.8, 0, 1);
    const contractionScore = clamp((contraction - WEDGE_MIN_CONTRACTION) / 0.45, 0, 1);
    const breakScore = breakoutIndex >= 0 ? 1 : 0.42;
    const confidence = clamp(
      0.18 + lineFit * 0.24 + slopeGap * 0.22 + contractionScore * 0.22 + breakScore * 0.14,
      0.24,
      0.95
    );
    const status: ChartPatternStatus = breakoutIndex >= 0 ? 'CONFIRMED' : 'FORMING';
    const lineEndIndex = markerIndex;

    const detection: ChartPatternDetection = {
      id: `fw-${klines[start].time}-${marker.time}`,
      kind: 'falling_wedge',
      name: 'Falling Wedge',
      shortName: 'FW',
      direction: 'BULLISH',
      status,
      confidence,
      startTime: klines[start].time,
      endTime: marker.time,
      markerTime: marker.time,
      markerPrice: marker.low,
      guideLines: [
        {
          id: `fw-upper-${marker.time}`,
          label: 'upper',
          color: '#ffba30',
          style: 'dashed',
          from: { time: klines[start].time, price: upperAt(start) },
          to: { time: klines[lineEndIndex].time, price: upperAt(lineEndIndex) },
        },
        {
          id: `fw-lower-${marker.time}`,
          label: 'lower',
          color: '#ffd96b',
          style: 'dashed',
          from: { time: klines[start].time, price: lowerAt(start) },
          to: { time: klines[lineEndIndex].time, price: lowerAt(lineEndIndex) },
        },
      ],
    };

    if (!best) {
      best = detection;
      continue;
    }
    if (detection.status === 'CONFIRMED' && best.status !== 'CONFIRMED') {
      best = detection;
      continue;
    }
    if (detection.endTime > best.endTime) best = detection;
    else if (detection.endTime === best.endTime && detection.confidence > best.confidence) best = detection;
  }

  return best;
}

export function detectChartPatterns(
  klines: BinanceKline[],
  options: ChartPatternOptions = {}
): ChartPatternDetection[] {
  if (klines.length < 30) return [];
  const lookaround = Math.max(2, options.pivotLookaround ?? 2);
  const maxPatterns = Math.max(1, options.maxPatterns ?? 3);

  const detections: ChartPatternDetection[] = [];
  const hs = detectHeadAndShoulders(klines, lookaround);
  const fw = detectFallingWedge(klines, lookaround);
  if (hs) detections.push(hs);
  if (fw) detections.push(fw);

  return uniqueById(detections)
    .sort((a, b) => (b.endTime - a.endTime) || (b.confidence - a.confidence))
    .slice(0, maxPatterns);
}
