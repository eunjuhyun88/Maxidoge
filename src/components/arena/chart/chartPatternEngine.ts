// ═══════════════════════════════════════════════════════════════
// Stockclaw — Chart Pattern Engine (Pure Helpers)
// ═══════════════════════════════════════════════════════════════
// Extracted from ChartPanel.svelte. All functions are pure —
// no component state, no side effects.

import { detectChartPatterns, type ChartPatternDetection } from '$lib/engine/patternDetector';
import type { ChartMarker, PatternScanReport, PatternScanScope } from '$lib/chart/chartTypes';
import type { BinanceKline } from '$lib/api/binance';

export interface ChartPatternStateSnapshot {
  signature: string;
  detectedPatterns: ChartPatternDetection[];
  overlayPatterns: ChartPatternDetection[];
  patternMarkers: ChartMarker[];
}

// ── Pattern Ranking ─────────────────────────────────────────

/** Sort patterns by confirmed-first, then confidence desc, then recency */
export function rankPatternsForOverlay(patterns: ChartPatternDetection[]): ChartPatternDetection[] {
  return [...patterns].sort((a, b) => {
    const statusDiff = (b.status === 'CONFIRMED' ? 1 : 0) - (a.status === 'CONFIRMED' ? 1 : 0);
    if (statusDiff !== 0) return statusDiff;
    const confidenceDiff = b.confidence - a.confidence;
    if (Math.abs(confidenceDiff) > 1e-6) return confidenceDiff;
    return b.endTime - a.endTime;
  });
}

// ── Pattern Snapshot ────────────────────────────────────────

export interface PatternSnapshot {
  kind: ChartPatternDetection['kind'];
  shortName: string;
  direction: ChartPatternDetection['direction'];
  status: ChartPatternDetection['status'];
  confidence: number;
  startTime: number;
  endTime: number;
}

/** Extract a serializable snapshot of a pattern detection */
export function snapshotPattern(pattern: ChartPatternDetection): PatternSnapshot {
  return {
    kind: pattern.kind,
    shortName: pattern.shortName,
    direction: pattern.direction,
    status: pattern.status,
    confidence: pattern.confidence,
    startTime: pattern.startTime,
    endTime: pattern.endTime,
  };
}

// ── Pattern Summary Text ────────────────────────────────────

export function buildPatternSummary(patterns: ChartPatternDetection[]): string {
  if (patterns.length === 0) return '패턴 미감지 · 조건 미충족';
  const summary = patterns
    .slice(0, 2)
    .map((p) => `${p.shortName} ${Math.round(p.confidence * 100)}%`)
    .join(' · ');
  return `패턴 ${patterns.length}개 감지 · ${summary}`;
}

// ── Pattern → Chart Marker ──────────────────────────────────

export function toPatternMarker(pattern: ChartPatternDetection): ChartMarker {
  const isBear = pattern.direction === 'BEARISH';
  const isConfirmed = pattern.status === 'CONFIRMED';
  const confidencePct = Math.round(pattern.confidence * 100);
  return {
    time: pattern.markerTime,
    position: isBear ? 'aboveBar' : 'belowBar',
    color: isBear ? '#ff657a' : '#58d78d',
    shape: isConfirmed ? (isBear ? 'arrowDown' : 'arrowUp') : 'circle',
    text: `${pattern.shortName} ${isConfirmed ? 'OK' : 'PEND'} ${confidencePct}%`,
  };
}

// ── Pattern State Snapshot ──────────────────────────────────

export function emptyChartPatternState(): ChartPatternStateSnapshot {
  return {
    signature: '',
    detectedPatterns: [],
    overlayPatterns: [],
    patternMarkers: [],
  };
}

export function buildPatternSignature(patterns: ChartPatternDetection[]): string {
  return patterns
    .map((pattern) => `${pattern.id}:${pattern.status}:${Math.round(pattern.confidence * 100)}`)
    .join('|');
}

export function buildChartPatternState(
  patterns: ChartPatternDetection[],
  maxOverlayPatterns: number,
): ChartPatternStateSnapshot {
  const overlayPatterns = rankPatternsForOverlay(patterns).slice(0, maxOverlayPatterns);
  return {
    signature: buildPatternSignature(patterns),
    detectedPatterns: patterns,
    overlayPatterns,
    patternMarkers: overlayPatterns.map(toPatternMarker),
  };
}

// ── Visible Scope Candle Slice ──────────────────────────────

export function getVisibleScopeCandles(
  klineCache: BinanceKline[],
  range: { from: number; to: number } | null | undefined,
): BinanceKline[] {
  if (!Array.isArray(klineCache) || klineCache.length === 0 || !range) return [];
  if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) return [];
  const from = Math.max(0, Math.floor(range.from));
  const to = Math.min(klineCache.length - 1, Math.ceil(range.to));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];
  return klineCache.slice(from, to + 1);
}

// ── Pattern Detection Driver ────────────────────────────────

export function detectChartPatternState(options: {
  scope?: PatternScanScope;
  fullCandles: BinanceKline[];
  visibleCandles?: BinanceKline[];
  fallbackToFull?: boolean;
  minCandles: number;
  maxPatterns: number;
  pivotLookaround: number;
  maxOverlayPatterns: number;
}): { report: PatternScanReport; state: ChartPatternStateSnapshot } {
  const scope = options.scope ?? 'visible';
  const fallbackToFull = options.fallbackToFull ?? false;
  const fullCandles = Array.isArray(options.fullCandles) ? options.fullCandles : [];
  const visibleCandles = Array.isArray(options.visibleCandles) ? options.visibleCandles : [];

  if (fullCandles.length < options.minCandles) {
    return {
      report: {
        ok: false,
        scope,
        candleCount: fullCandles.length,
        patternCount: 0,
        patterns: [],
        message: '캔들 데이터가 부족해 패턴을 분석할 수 없습니다.',
      },
      state: emptyChartPatternState(),
    };
  }

  let effectiveScope: PatternScanScope = scope;
  let sourceCandles = scope === 'visible' ? visibleCandles : fullCandles;
  if (sourceCandles.length < options.minCandles && scope === 'visible' && fallbackToFull) {
    effectiveScope = 'full';
    sourceCandles = fullCandles;
  }
  if (sourceCandles.length < options.minCandles) {
    return {
      report: {
        ok: false,
        scope: effectiveScope,
        candleCount: sourceCandles.length,
        patternCount: 0,
        patterns: [],
        message: '보이는 구간 캔들이 부족합니다. 조금 줌아웃한 뒤 다시 시도하세요.',
      },
      state: emptyChartPatternState(),
    };
  }

  const detected = detectChartPatterns(sourceCandles, {
    maxPatterns: options.maxPatterns,
    pivotLookaround: options.pivotLookaround,
  });
  return {
    report: {
      ok: detected.length > 0,
      scope: effectiveScope,
      candleCount: sourceCandles.length,
      patternCount: detected.length,
      patterns: detected.map(snapshotPattern),
      message: buildPatternSummary(detected),
    },
    state: buildChartPatternState(detected, options.maxOverlayPatterns),
  };
}

// ── Confidence Clamp ────────────────────────────────────────

export function clampConfidence(v: number): number {
  if (!Number.isFinite(v)) return 68;
  return Math.max(1, Math.min(100, Math.round(v)));
}

// ── 24h Stats from Klines ───────────────────────────────────

export interface Stats24h {
  high: number | null;
  low: number | null;
  quoteVolume: number | null;
}

/** Compute 24h high/low/volume from kline array (pure — returns values) */
export function compute24hStatsFromKlines(klines: BinanceKline[]): Stats24h {
  if (!Array.isArray(klines) || klines.length === 0) return { high: null, low: null, quoteVolume: null };
  let hi = Number.NEGATIVE_INFINITY;
  let lo = Number.POSITIVE_INFINITY;
  let qv = 0;
  for (const k of klines) {
    if (Number.isFinite(k.high)) hi = Math.max(hi, k.high);
    if (Number.isFinite(k.low)) lo = Math.min(lo, k.low);
    if (Number.isFinite(k.volume) && Number.isFinite(k.close)) qv += k.volume * k.close;
  }
  return {
    high: Number.isFinite(hi) && hi > 0 ? hi : null,
    low: Number.isFinite(lo) && lo > 0 ? lo : null,
    quoteVolume: Number.isFinite(qv) && qv > 0 ? qv : null,
  };
}
