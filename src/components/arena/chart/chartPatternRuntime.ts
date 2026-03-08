import type { BinanceKline } from '$lib/api/binance';
import type { ChartMarker, PatternScanReport, PatternScanScope } from '$lib/chart/chartTypes';
import { MAX_OVERLAY_PATTERNS, MIN_PATTERN_CANDLES } from '$lib/chart/chartIndicators';
import type { ChartPatternDetection } from '$lib/engine/patternDetector';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import {
  detectChartPatternState,
  emptyChartPatternState,
  getVisibleScopeCandles,
  type ChartPatternStateSnapshot,
} from './chartPatternEngine';

export interface ChartPatternRuntimeController {
  applyCombinedMarkers(): void;
  applyPatternStateSnapshot(
    nextState: ChartPatternStateSnapshot,
    options?: { force?: boolean },
  ): void;
  clearDetectedPatterns(): void;
  clearScheduledScan(): void;
  scheduleVisiblePatternScan(): void;
  runPatternDetection(
    scope?: PatternScanScope,
    opts?: { fallbackToFull?: boolean },
  ): PatternScanReport;
  focusPatternRange(pattern: ChartPatternDetection): void;
  dispose(): void;
}

export interface CreateChartPatternRuntimeOptions {
  getChart: () => IChartApi | null;
  getSeries: () => ISeriesApi<'Candlestick'> | null;
  getLwcModule: () => typeof import('lightweight-charts') | null;
  getKlineCache: () => BinanceKline[];
  getAgentMarkers: () => ChartMarker[];
  getOverlayPatterns: () => ChartPatternDetection[];
  setOverlayPatterns: (patterns: ChartPatternDetection[]) => void;
  setPatternMarkers: (markers: ChartMarker[]) => void;
  renderDrawings: () => void;
  enablePatternLineSeries?: boolean;
}

export function createChartPatternRuntime(
  options: CreateChartPatternRuntimeOptions,
): ChartPatternRuntimeController {
  let patternMarkers: ChartMarker[] = [];
  let patternLineSeries: ISeriesApi<'Line'>[] = [];
  let patternSignature = '';
  let patternRangeScanTimer: ReturnType<typeof setTimeout> | null = null;
  const enablePatternLineSeries = options.enablePatternLineSeries ?? false;

  function clearPatternLineSeries() {
    const chart = options.getChart();
    if (!chart || patternLineSeries.length === 0) {
      patternLineSeries = [];
      return;
    }
    for (const lineSeries of patternLineSeries) {
      try {
        chart.removeSeries(lineSeries);
      } catch {}
    }
    patternLineSeries = [];
  }

  function applyPatternLineSeries() {
    if (!enablePatternLineSeries) {
      clearPatternLineSeries();
      return;
    }

    const chart = options.getChart();
    const lwcModule = options.getLwcModule();
    if (!chart || !lwcModule) return;

    clearPatternLineSeries();

    for (const pattern of options.getOverlayPatterns()) {
      for (const guide of pattern.guideLines) {
        try {
          const lineSeries = chart.addSeries(lwcModule.LineSeries, {
            color: guide.color,
            lineWidth: (pattern.status === 'CONFIRMED' ? 2 : 1.5) as never,
            lineStyle: guide.style === 'dashed' ? 2 : 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          lineSeries.setData([
            { time: guide.from.time as never, value: guide.from.price },
            { time: guide.to.time as never, value: guide.to.price },
          ]);
          patternLineSeries.push(lineSeries);
        } catch (error) {
          console.error('[ChartPanel] pattern line render error', error);
        }
      }
    }
  }

  function applyCombinedMarkers() {
    const series = options.getSeries();
    if (!series) return;
    try {
      (series as any).setMarkers([...options.getAgentMarkers(), ...patternMarkers]);
    } catch {}
  }

  function applyPatternStateSnapshot(
    nextState: ChartPatternStateSnapshot,
    optionsPatch: { force?: boolean } = {},
  ) {
    if (!optionsPatch.force && nextState.signature === patternSignature) return;
    patternSignature = nextState.signature;
    patternMarkers = nextState.patternMarkers;
    options.setOverlayPatterns(nextState.overlayPatterns);
    options.setPatternMarkers(nextState.patternMarkers);
    applyCombinedMarkers();
    applyPatternLineSeries();
    options.renderDrawings();
  }

  function clearDetectedPatterns() {
    applyPatternStateSnapshot(emptyChartPatternState(), { force: true });
  }

  function getVisibleLogicalRange(): { from: number; to: number } | null {
    const chart = options.getChart();
    if (!chart) return null;
    try {
      const range = chart.timeScale?.().getVisibleLogicalRange?.();
      if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
      return { from: range.from, to: range.to };
    } catch {
      return null;
    }
  }

  function runPatternDetection(
    scope: PatternScanScope = 'visible',
    opts: { fallbackToFull?: boolean } = {},
  ): PatternScanReport {
    const chart = options.getChart();
    const series = options.getSeries();
    const klineCache = options.getKlineCache();

    if (!chart || !series || klineCache.length < MIN_PATTERN_CANDLES) {
      clearDetectedPatterns();
      return {
        ok: false,
        scope,
        candleCount: klineCache.length,
        patternCount: 0,
        patterns: [],
        message: '캔들 데이터가 부족해 패턴을 분석할 수 없습니다.',
      };
    }

    const visibleCandles = getVisibleScopeCandles(klineCache, getVisibleLogicalRange());
    const detection = detectChartPatternState({
      scope,
      fullCandles: klineCache,
      visibleCandles,
      fallbackToFull: opts.fallbackToFull ?? false,
      minCandles: MIN_PATTERN_CANDLES,
      maxPatterns: 3,
      pivotLookaround: 2,
      maxOverlayPatterns: MAX_OVERLAY_PATTERNS,
    });
    applyPatternStateSnapshot(detection.state, { force: !detection.report.ok });
    return detection.report;
  }

  function clearScheduledScan() {
    if (patternRangeScanTimer) {
      clearTimeout(patternRangeScanTimer);
      patternRangeScanTimer = null;
    }
  }

  function scheduleVisiblePatternScan() {
    clearScheduledScan();
    patternRangeScanTimer = setTimeout(() => {
      patternRangeScanTimer = null;
      runPatternDetection('visible', { fallbackToFull: true });
    }, 120);
  }

  function focusPatternRange(pattern: ChartPatternDetection) {
    const chart = options.getChart();
    if (!chart) return;
    const span = Math.max(1, pattern.endTime - pattern.startTime);
    const from = Math.max(0, pattern.startTime - Math.round(span * 0.25));
    const to = pattern.endTime + Math.round(span * 0.35);
    try {
      chart.timeScale().setVisibleRange({ from, to } as never);
    } catch {}
  }

  function dispose() {
    clearScheduledScan();
    clearPatternLineSeries();
    patternMarkers = [];
    patternSignature = '';
  }

  return {
    applyCombinedMarkers,
    applyPatternStateSnapshot,
    clearDetectedPatterns,
    clearScheduledScan,
    scheduleVisiblePatternScan,
    runPatternDetection,
    focusPatternRange,
    dispose,
  };
}
