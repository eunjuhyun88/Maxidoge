// ═══════════════════════════════════════════════════════════════
// Stockclaw — Chart Type Definitions
// ═══════════════════════════════════════════════════════════════
// TypeScript interfaces for lightweight-charts integration.
// type-only imports are SSR-safe (erased at compile time).

import type {
  IChartApi,
  ISeriesApi,
  IPriceLine,
  Time,
} from 'lightweight-charts';
import type { BinanceKline } from '$lib/engine/types';
import type {
  ChartPatternDirection,
  ChartPatternKind,
  ChartPatternStatus,
} from '$lib/engine/patternDetector';

// ── Chart Core Context ───────────────────────────────────────

export type LWCModule = typeof import('lightweight-charts');

export interface ChartContext {
  chart: IChartApi;
  mainSeries: ISeriesApi<'Candlestick'>;
  lwcModule: LWCModule;
  klineCache: BinanceKline[];
  chartContainer: HTMLDivElement;
}

// ── Indicator Series ─────────────────────────────────────────

export interface IndicatorSeries {
  ma7: ISeriesApi<'Line'> | null;
  ma20: ISeriesApi<'Line'> | null;
  ma25: ISeriesApi<'Line'> | null;
  ma60: ISeriesApi<'Line'> | null;
  ma99: ISeriesApi<'Line'> | null;
  ma120: ISeriesApi<'Line'> | null;
  rsi: ISeriesApi<'Line'> | null;
  volume: ISeriesApi<'Histogram'> | null;
  bbUpper: ISeriesApi<'Line'> | null;
  bbMiddle: ISeriesApi<'Line'> | null;
  bbLower: ISeriesApi<'Line'> | null;
  macdLine: ISeriesApi<'Line'> | null;
  macdSignal: ISeriesApi<'Line'> | null;
  macdHist: ISeriesApi<'Histogram'> | null;
  stochK: ISeriesApi<'Line'> | null;
  stochD: ISeriesApi<'Line'> | null;
  oi: ISeriesApi<'Line'> | null;
  funding: ISeriesApi<'Histogram'> | null;
  liqLong: ISeriesApi<'Histogram'> | null;
  liqShort: ISeriesApi<'Histogram'> | null;
}

export type IndicatorKey = 'ma7' | 'ma20' | 'ma25' | 'ma60' | 'ma99' | 'ma120' | 'rsi' | 'vol' | 'bb' | 'macd' | 'stoch' | 'oi' | 'funding' | 'liq';

// ── Position / Price Lines ───────────────────────────────────

export interface PositionLines {
  tp: IPriceLine | null;
  entry: IPriceLine | null;
  sl: IPriceLine | null;
}

// ── Drawing Tools ────────────────────────────────────────────

export type DrawingMode =
  | 'none'
  // Lines
  | 'hline' | 'vline' | 'trendline' | 'ray' | 'channel' | 'extended_line'
  // Fibonacci
  | 'fib_retracement'
  // Position
  | 'longentry' | 'shortentry' | 'trade'
  // Shape
  | 'rect'
  // Measure
  | 'price_range' | 'date_range'
  // Text
  | 'text'
  // Eraser
  | 'eraser';

export type DrawingAnchorPoint = { time: number; price: number };

export type DrawingItemType =
  | 'hline' | 'vline' | 'trendline' | 'ray' | 'channel'
  | 'fib_retracement' | 'rect' | 'tradebox'
  | 'price_range' | 'date_range' | 'text';

export type DrawingItem =
  | {
      id: string;
      type: 'hline';
      points: Array<{ x: number; y: number }>;
      price?: number;
      color: string;
    }
  | {
      id: string;
      type: 'vline';
      points: Array<{ x: number; y: number }>;
      anchor?: DrawingAnchorPoint;
      color: string;
    }
  | {
      id: string;
      type: 'trendline';
      points: Array<{ x: number; y: number }>;
      anchors?: [DrawingAnchorPoint, DrawingAnchorPoint];
      color: string;
    }
  | {
      id: string;
      type: 'ray';
      points: Array<{ x: number; y: number }>;
      anchors?: [DrawingAnchorPoint, DrawingAnchorPoint];
      color: string;
    }
  | {
      id: string;
      type: 'fib_retracement';
      points: Array<{ x: number; y: number }>;
      anchors?: [DrawingAnchorPoint, DrawingAnchorPoint];
      levels: number[];
      color: string;
    }
  | {
      id: string;
      type: 'rect';
      points: Array<{ x: number; y: number }>;
      anchors?: [DrawingAnchorPoint, DrawingAnchorPoint];
      color: string;
      fillColor?: string;
    }
  | {
      id: string;
      type: 'price_range';
      points: Array<{ x: number; y: number }>;
      anchors?: [DrawingAnchorPoint, DrawingAnchorPoint];
      color: string;
    }
  | {
      id: string;
      type: 'tradebox';
      points: Array<{ x: number; y: number }>;
      fromTime?: number;
      toTime?: number;
      color: string;
      dir: 'LONG' | 'SHORT';
      entry: number;
      sl: number;
      tp: number;
      rr: number;
      riskPct: number;
    };

// ── Drawing ID Generator ────────────────────────────────────

let _drawingIdCounter = 0;
export function generateDrawingId(): string {
  return `d_${Date.now()}_${++_drawingIdCounter}`;
}

// ── Agent Trade Setup Overlay ────────────────────────────────

export interface AgentTradeSetup {
  source: 'consensus' | 'agent';
  agentName?: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  conf: number;
  pair: string;
}

// ── Trade Plan Draft ─────────────────────────────────────────

export interface TradePlanDraft {
  pair: string;
  previewDir: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  riskPct: number;
  longRatio: number;
}

export interface PlannedTradeOrder {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  riskPct: number;
  longRatio: number;
  shortRatio: number;
}

export interface LineEntryTradeDraft {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp: number;
  rr: number;
}

export interface CommunitySignalDraft {
  pair: string;
  dir: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  rr: number;
  conf: number;
  source: string;
  reason: string;
}

// ── Chart Marker ─────────────────────────────────────────────

export interface ChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
}

export type PatternScanScope = 'visible' | 'full';

export interface PatternScanReport {
  ok: boolean;
  scope: PatternScanScope;
  candleCount: number;
  patternCount: number;
  patterns: Array<{
    kind: ChartPatternKind;
    shortName: string;
    direction: ChartPatternDirection;
    status: ChartPatternStatus;
    confidence: number;
    startTime: number;
    endTime: number;
  }>;
  message: string;
}

// ── Trade Preview ────────────────────────────────────────────

export interface TradePreviewData {
  mode: 'longentry' | 'shortentry';
  dir: 'LONG' | 'SHORT';
  left: number;
  right: number;
  entryY: number;
  slY: number;
  tpY: number;
  entry: number;
  sl: number;
  tp: number;
  rr: number;
  riskPct: number;
}

// ── Re-export lightweight-charts types for convenience ───────

export type { IChartApi, ISeriesApi, IPriceLine, Time };
