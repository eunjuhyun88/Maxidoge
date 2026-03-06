<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { gameState } from '$lib/stores/gameState';
  import {
    fetch24hr,
    fetchKlines,
    pairToSymbol,
    subscribeKlines,
    subscribeMiniTicker,
    type BinanceKline
  } from '$lib/api/binance';
  import { livePrices, updatePrice } from '$lib/stores/priceStore';
  import { getBaseSymbolFromPair, getPairPrice } from '$lib/utils/price';
  import {
    CORE_TIMEFRAME_OPTIONS,
    normalizeTimeframe,
    toBinanceInterval,
  } from '$lib/utils/timeframe';
  import { openQuickTrade, type TradeDirection } from '$lib/stores/quickTradeStore';
  import type { ChartPatternDetection } from '$lib/engine/patternDetector';
  import type { IChartApi, ISeriesApi, IPriceLine } from 'lightweight-charts';
  import TokenDropdown from '../shared/TokenDropdown.svelte';
  import {
    type ChartTheme,
    FALLBACK_THEME,
    withAlpha,
    toTvHex,
    resolveChartTheme,
  } from './ChartTheme';
  import type { DrawingMode, DrawingAnchorPoint, DrawingItem, AgentTradeSetup, TradePlanDraft, ChartMarker, PatternScanScope, PatternScanReport } from '$lib/chart/chartTypes';
  import type { IndicatorKey } from '$lib/chart/chartTypes';
  import { formatPrice, formatCompact, clampRoundPrice, normalizeChartTime } from '$lib/chart/chartCoordinates';
  import { normalizeMarketPrice, clampRatio, isCompactViewport, generateCandles, gtmEvent } from '$lib/chart/chartHelpers';
  import { computeSMA, computeRSI, updateRSIIncremental, BAR_SPACING, MAX_KLINE_CACHE, MAX_DRAWINGS, MIN_PATTERN_CANDLES, MAX_OVERLAY_PATTERNS, getIndicatorProfile } from '$lib/chart/chartIndicators';
  import {
    buildCommunitySignalDraft,
    getPlannedTradeOrder,
    withTradePlanRatio,
  } from '$lib/chart/chartTradePlanner';
  import {
    destroyTradingViewEmbed,
    mountTradingViewEmbed,
    pairToTradingViewSymbol,
    type TradingViewEmbedInstance,
  } from '$lib/chart/tradingviewEmbed';
  import {
    makeTradeBoxDrawing as _makeTradeBoxDrawing,
    type TradePreview,
  } from './chart/chartDrawingEngine';
  import {
    drawTrendlineGhost,
    isTradePreviewMode,
    renderChartOverlay,
    resolveTradePreview,
  } from './chart/chartOverlayRenderer';
  import {
    appendDrawingWithLimit,
    buildHorizontalLineDrawing,
    completeTrendlineDraft,
    finalizeTradePreview,
    startTradePreviewDraft,
    startTrendlineDraft,
    updateTradePreviewDraft,
    type TradePreviewDraft,
    type TrendlineDraft,
  } from './chart/chartDrawingSession';
  import {
    type ChartPatternStateSnapshot,
    emptyChartPatternState,
    getVisibleScopeCandles as sliceVisibleScopeCandles,
    detectChartPatternState,
    compute24hStatsFromKlines,
  } from './chart/chartPatternEngine';

  // ═══ Props ═══
  interface Props {
    posEntry?: number | null;
    posTp?: number | null;
    posSl?: number | null;
    posDir?: string;
    showPosition?: boolean;
    advancedMode?: boolean;
    enableTradeLineEntry?: boolean;
    uiPreset?: 'default' | 'tradingview';
    requireTradeConfirm?: boolean;
    chatFirstMode?: boolean;
    chatTradeReady?: boolean;
    chatTradeDir?: 'LONG' | 'SHORT';
    hasScanned?: boolean;
    activeTradeSetup?: AgentTradeSetup | null;
    agentMarkers?: ChartMarker[];
    agentAnnotations?: Array<{
      id: string; icon: string; name: string; color: string; label: string;
      detail: string; yPercent: number; xPercent: number;
      type: 'ob' | 'funding' | 'whale' | 'signal';
    }>;
    onScanRequest?: (detail: { source: string; pair: string; timeframe: string }) => void;
    onChatRequest?: (detail: { source: string; pair: string; timeframe: string }) => void;
    onCommunitySignal?: (detail: {
      pair: string; dir: 'LONG' | 'SHORT'; entry: number; tp: number; sl: number;
      conf: number; source: string; reason: string; openCopyTrade: boolean;
    }) => void;
    onPriceUpdate?: (detail: { price: number }) => void;
    onDragTP?: (detail: { price: number }) => void;
    onDragSL?: (detail: { price: number }) => void;
    onDragEntry?: (detail: { price: number }) => void;
    onClearTradeSetup?: () => void;
  }
  interface ChartPanelEvents {
    scanrequest: { source: string; pair: string; timeframe: string };
    chatrequest: { source: string; pair: string; timeframe: string };
    communitysignal: {
      pair: string;
      dir: 'LONG' | 'SHORT';
      entry: number;
      tp: number;
      sl: number;
      conf: number;
      source: string;
      reason: string;
      openCopyTrade: boolean;
    };
    priceUpdate: { price: number };
    dragTP: { price: number };
    dragSL: { price: number };
    dragEntry: { price: number };
    clearTradeSetup: void;
  }
  let {
    posEntry = null,
    posTp = null,
    posSl = null,
    posDir = 'LONG',
    showPosition = false,
    advancedMode = false,
    enableTradeLineEntry = false,
    uiPreset = 'default',
    requireTradeConfirm = false,
    chatFirstMode = false,
    chatTradeReady = false,
    chatTradeDir = 'LONG',
    hasScanned = false,
    activeTradeSetup = null,
    agentMarkers = [],
    agentAnnotations = [],
    onScanRequest = () => {},
    onChatRequest = () => {},
    onCommunitySignal = () => {},
    onPriceUpdate = () => {},
    onDragTP = () => {},
    onDragSL = () => {},
    onDragEntry = () => {},
    onClearTradeSetup = () => {},
  }: Props = $props();
  const dispatch = createEventDispatcher<ChartPanelEvents>();

  function emitScanRequest(detail: ChartPanelEvents['scanrequest']) {
    onScanRequest(detail);
    dispatch('scanrequest', detail);
  }

  function emitChatRequest(detail: ChartPanelEvents['chatrequest']) {
    onChatRequest(detail);
    dispatch('chatrequest', detail);
  }

  function emitCommunitySignal(detail: ChartPanelEvents['communitysignal']) {
    onCommunitySignal(detail);
    dispatch('communitysignal', detail);
  }

  function emitPriceUpdate(detail: ChartPanelEvents['priceUpdate']) {
    onPriceUpdate(detail);
    dispatch('priceUpdate', detail);
  }

  function emitDrag(target: 'dragTP' | 'dragSL' | 'dragEntry', detail: { price: number }) {
    if (target === 'dragTP') onDragTP(detail);
    else if (target === 'dragSL') onDragSL(detail);
    else onDragEntry(detail);
    dispatch(target, detail);
  }

  function emitClearTradeSetup() {
    onClearTradeSetup();
    dispatch('clearTradeSetup');
  }

  let chartContainer: HTMLDivElement;
  let chart: IChartApi | null = null;
  let lwcModule: typeof import('lightweight-charts') | null = null;
  let series: ISeriesApi<'Candlestick'> | null = $state(null);
  let volumeSeries: ISeriesApi<'Histogram'> | null = null;
  let cleanup: (() => void) | null = null;
  let wsCleanup: (() => void) | null = null;
  let priceWsCleanup: (() => void) | null = null;

  // ═══ Indicator Series ═══
  let ma7Series: ISeriesApi<'Line'> | null = null;
  let ma20Series: ISeriesApi<'Line'> | null = null;
  let ma25Series: ISeriesApi<'Line'> | null = null;
  let ma60Series: ISeriesApi<'Line'> | null = null;
  let ma99Series: ISeriesApi<'Line'> | null = null;
  let ma120Series: ISeriesApi<'Line'> | null = null;
  let rsiSeries: ISeriesApi<'Line'> | null = null;
  let volumePaneIndex: number | null = null;
  let rsiPaneIndex: number | null = null;
  let klineCache = $state<BinanceKline[]>([]);
  let _isLoadingMore = false;
  let _noMoreHistory = false; // true when Binance returns 0 older candles
  let _currentSymbol = '';
  let _currentInterval = '';

  // ═══ Incremental indicator state (avoid full recompute on each WS tick) ═══
  let _rsiAvgGain = 0;
  let _rsiAvgLoss = 0;
  let _maRunSum: Record<number, number> = {}; // period → running sum for O(1) MA updates
  // MA period config for data-driven WS updates (rebuilt when series refs change in loadKlines)
  let _maPeriods: Array<{ p: number; s: ISeriesApi<'Line'> | null; setVal: (v: number) => void }> = [];

  // ═══ Cached MA values for template display ═══
  let ma7Val = $state(0);
  let ma20Val = $state(0);
  let ma25Val = $state(0);
  let ma60Val = $state(0);
  let ma99Val = $state(0);
  let ma120Val = $state(0);
  let rsiVal = $state(0);
  let latestVolume = $state(0);

  // ═══ Chart Mode ═══
  let chartMode: 'agent' | 'trading' = $state('agent');
  let tvWidget: TradingViewEmbedInstance | null = null;
  let tvContainer = $state<HTMLDivElement | null>(null);
  let tvScriptLoaded = $state(false);
  let tvLoading = $state(false);
  let tvError = $state('');
  let tvSafeMode = $state(false);
  let _tvFallbackTried = $state(false);
  let _tvLoadTimer: ReturnType<typeof setTimeout> | null = null;
  let _tvReinitKey = '';

  // ═══ Drawing Tools ═══
  let drawingCanvas = $state<HTMLCanvasElement | null>(null);
  let _drawCtx: CanvasRenderingContext2D | null = null;
  let drawingMode: DrawingMode = $state('none');
  let drawings = $state<DrawingItem[]>([]);
  let currentDrawing: TrendlineDraft | null = null;
  let tradePreview: TradePreviewDraft | null = $state(null);
  let pendingTradePlan: TradePlanDraft | null = $state(null);
  let ratioTrackEl = $state<HTMLButtonElement | null>(null);
  let _ratioDragPointerId: number | null = null;
  let _ratioDragBound = false;
  let isDrawing = $state(false);
  let drawingsVisible = $state(true);
  let _agentCloseBtn: { x: number; y: number; r: number } | null = null; // ✕ button hit area
  let chartNotice = $state('');
  let _chartNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  // Position lines
  let tpLine: IPriceLine | null = null;
  let entryLine: IPriceLine | null = null;
  let slLine: IPriceLine | null = null;

  // (posEntry, posTp, posSl, posDir, showPosition, advancedMode, enableTradeLineEntry,
  //  uiPreset, requireTradeConfirm, chatFirstMode, chatTradeReady, chatTradeDir,
  //  hasScanned, activeTradeSetup — all via $props() above)

  let agentPriceLines: { tp: IPriceLine | null; entry: IPriceLine | null; sl: IPriceLine | null } = { tp: null, entry: null, sl: null };

  // agentMarkers — via $props() above
  let patternMarkers: ChartMarker[] = $state([]);
  let detectedPatterns: ChartPatternDetection[] = $state([]);
  let overlayPatterns: ChartPatternDetection[] = $state([]);
  let patternLineSeries: ISeriesApi<'Line'>[] = [];
  const ENABLE_PATTERN_LINE_SERIES = false;
  let _patternSignature = '';
  let _patternRangeScanTimer: ReturnType<typeof setTimeout> | null = null;

  // agentAnnotations — via $props() above

  let selectedAnnotation: typeof agentAnnotations[0] | null = $state(null);

  const storeState = $derived($gameState);
  const symbol = $derived(pairToSymbol(storeState.pair));
  const interval = $derived(toBinanceInterval(storeState.timeframe));
  const pairBaseLabel = $derived((storeState.pair?.split('/')?.[0] || 'BTC').toUpperCase());
  const pairQuoteLabel = $derived((storeState.pair?.split('/')?.[1] || 'USDT').toUpperCase());
  const pairBaseFallbackSymbol = $derived(getBaseSymbolFromPair(storeState.pair) || 'BTC');
  const pairBaseFallbackPrice = $derived(storeState.bases[pairBaseFallbackSymbol as keyof typeof storeState.bases] || storeState.bases.BTC || 0);

  let indicatorEnabled: Record<IndicatorKey, boolean> = $state({
    ma20: true,
    ma60: true,
    ma120: true,
    ma7: true,
    ma25: true,
    ma99: true,
    rsi: true,
    vol: true,
  });
  let chartVisualMode: 'focus' | 'full' = $state('focus');
  let showIndicatorLegend = $state(true);
  let indicatorStripState: 'expanded' | 'collapsed' | 'hidden' = $state('collapsed');
  const isTvLikePreset = $derived(uiPreset === 'tradingview');
  let _indicatorProfileApplied: string | null = null;
  let barSpacing: number = BAR_SPACING.DEFAULT;
  let autoScaleY = $state(true);

  let chartTheme: ChartTheme = $state(FALLBACK_THEME);

  function pushChartNotice(msg: string) {
    chartNotice = msg;
    if (_chartNoticeTimer) clearTimeout(_chartNoticeTimer);
    _chartNoticeTimer = setTimeout(() => {
      chartNotice = '';
      _chartNoticeTimer = null;
    }, 2800);
  }

  function toChartPrice(y: number): number | null {
    if (!series) return null;
    try { return series.coordinateToPrice(y); } catch { return null; }
  }

  function toChartY(price: number): number | null {
    if (!series) return null;
    try { return series.priceToCoordinate(price); } catch { return null; }
  }

  function toChartTime(x: number): number | null {
    if (!chart || !drawingCanvas || !Number.isFinite(x)) return null;
    try {
      const clampedX = Math.max(0, Math.min(x, drawingCanvas.width));
      const rawTime = chart.timeScale().coordinateToTime(clampedX as any);
      const parsedTime = normalizeChartTime(rawTime);
      if (parsedTime !== null) return parsedTime;
    } catch {}

    try {
      const logical = chart.timeScale().coordinateToLogical(x as any);
      if (logical !== null && Number.isFinite(logical) && klineCache.length > 0) {
        const idx = Math.max(0, Math.min(klineCache.length - 1, Math.round(logical)));
        const time = klineCache[idx]?.time;
        if (Number.isFinite(time)) return time;
      }
    } catch {}
    return null;
  }

  function toChartX(time: number): number | null {
    if (!chart || !Number.isFinite(time)) return null;
    try {
      const x = chart.timeScale().timeToCoordinate(time as any);
      if (Number.isFinite(x)) return x;
    } catch {}
    return null;
  }

  function toDrawingAnchor(x: number, y: number): DrawingAnchorPoint | null {
    const time = toChartTime(x);
    const price = toChartPrice(y);
    if (time === null || price === null || !Number.isFinite(price)) return null;
    return { time, price: clampRoundPrice(price) };
  }

  function setTradePlanRatio(nextLongRatio: number) {
    if (!pendingTradePlan) return;
    const nextPlan = withTradePlanRatio(pendingTradePlan, nextLongRatio);
    if (nextPlan === pendingTradePlan) return;
    pendingTradePlan = nextPlan;
  }

  // getPlannedTradeOrder — imported from chart/chartDrawingEngine.ts

  function openTradeFromPlan() {
    if (!pendingTradePlan) return;
    const planned = getPlannedTradeOrder(pendingTradePlan);
    openQuickTrade(
      planned.pair,
      planned.dir,
      planned.entry,
      planned.tp,
      planned.sl,
      'chart-plan',
      `ratio L${planned.longRatio}:S${planned.shortRatio}`
    );
    gtmEvent('terminal_chart_plan_open', {
      pair: planned.pair,
      dir: planned.dir,
      entry: planned.entry,
      tp: planned.tp,
      sl: planned.sl,
      rr: planned.rr,
      longRatio: planned.longRatio,
      shortRatio: planned.shortRatio,
    });
    pushChartNotice(
      `OPEN ${planned.dir} · ${planned.longRatio}:${planned.shortRatio} · ENTRY ${formatPrice(planned.entry)}`
    );
    pendingTradePlan = null;
  }

  function cancelTradePlan() {
    pendingTradePlan = null;
    pushChartNotice('Trade cancelled');
  }

  function ratioFromClientX(clientX: number): number | null {
    if (!ratioTrackEl) return null;
    const rect = ratioTrackEl.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || rect.width <= 0) return null;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    return clampRatio(pct);
  }

  function onRatioPointerMove(e: PointerEvent) {
    if (_ratioDragPointerId === null || e.pointerId !== _ratioDragPointerId) return;
    const ratio = ratioFromClientX(e.clientX);
    if (ratio === null) return;
    setTradePlanRatio(ratio);
  }

  function unbindRatioDrag() {
    if (!_ratioDragBound || typeof window === 'undefined') return;
    window.removeEventListener('pointermove', onRatioPointerMove);
    window.removeEventListener('pointerup', onRatioPointerUp);
    _ratioDragBound = false;
    _ratioDragPointerId = null;
  }

  function onRatioPointerUp(e: PointerEvent) {
    if (_ratioDragPointerId !== null && e.pointerId === _ratioDragPointerId) {
      unbindRatioDrag();
    }
  }

  function bindRatioDrag() {
    if (_ratioDragBound || typeof window === 'undefined') return;
    window.addEventListener('pointermove', onRatioPointerMove);
    window.addEventListener('pointerup', onRatioPointerUp);
    _ratioDragBound = true;
  }

  function handleRatioPointerDown(e: PointerEvent) {
    if (!pendingTradePlan) return;
    _ratioDragPointerId = e.pointerId;
    const ratio = ratioFromClientX(e.clientX);
    if (ratio !== null) setTradePlanRatio(ratio);
    bindRatioDrag();
  }

  function applyAgentTradeSetup(setup: AgentTradeSetup | null) {
    // Clear old price lines (no more axis labels — canvas only)
    if (agentPriceLines.tp && series) { try { series.removePriceLine(agentPriceLines.tp); } catch {} }
    if (agentPriceLines.entry && series) { try { series.removePriceLine(agentPriceLines.entry); } catch {} }
    if (agentPriceLines.sl && series) { try { series.removePriceLine(agentPriceLines.sl); } catch {} }
    agentPriceLines = { tp: null, entry: null, sl: null };
    if (!setup) _agentCloseBtn = null;
    renderDrawings();
  }

  function makeTradeBoxDrawing(preview: TradePreview): DrawingItem {
    return _makeTradeBoxDrawing(preview, toChartTime, chartTheme);
  }

  function applyIndicatorProfile() {
    indicatorEnabled = getIndicatorProfile(advancedMode, chartVisualMode);
  }

  function applyIndicatorVisibility() {
    if (ma7Series) ma7Series.applyOptions({ visible: indicatorEnabled.ma7 });
    if (ma20Series) ma20Series.applyOptions({ visible: indicatorEnabled.ma20 });
    if (ma25Series) ma25Series.applyOptions({ visible: indicatorEnabled.ma25 });
    if (ma60Series) ma60Series.applyOptions({ visible: indicatorEnabled.ma60 });
    if (ma99Series) ma99Series.applyOptions({ visible: indicatorEnabled.ma99 });
    if (ma120Series) ma120Series.applyOptions({ visible: indicatorEnabled.ma120 });
    if (rsiSeries) rsiSeries.applyOptions({ visible: indicatorEnabled.rsi });
    if (volumeSeries) volumeSeries.applyOptions({ visible: indicatorEnabled.vol });
    applyPaneLayout();
  }

  function applyPaneLayout() {
    if (!chart) return;
    try {
      const panes = chart.panes();
      const mainPane = panes?.[0];
      const volPane = volumePaneIndex !== null ? panes?.[volumePaneIndex] : null;
      const rsiPane = rsiPaneIndex !== null ? panes?.[rsiPaneIndex] : null;
      if (!mainPane || !volPane || !rsiPane) return;

      const volOn = indicatorEnabled.vol;
      const rsiOn = indicatorEnabled.rsi;

      if (volOn && rsiOn) {
        mainPane.setStretchFactor(0.82);
        volPane.setStretchFactor(0.09);
        rsiPane.setStretchFactor(0.09);
      } else if (volOn || rsiOn) {
        mainPane.setStretchFactor(0.9);
        volPane.setStretchFactor(volOn ? 0.1 : 0.02);
        rsiPane.setStretchFactor(rsiOn ? 0.1 : 0.02);
      } else {
        mainPane.setStretchFactor(0.96);
        volPane.setStretchFactor(0.02);
        rsiPane.setStretchFactor(0.02);
      }
    } catch {}
    renderDrawings();
  }

  function applyTimeScale() {
    if (!chart) return;
    chart.timeScale().applyOptions({
      barSpacing,
      minBarSpacing: 3,
      rightOffset: 6,
    });
    renderDrawings();
  }

  function zoomChart(direction: 1 | -1) {
    barSpacing = Math.max(BAR_SPACING.MIN, Math.min(BAR_SPACING.MAX, barSpacing + direction * BAR_SPACING.STEP));
    applyTimeScale();
    pushChartNotice(`ZOOM ${barSpacing.toFixed(1)}`);
  }

  function fitChartRange() {
    if (!chart) return;
    chart.timeScale().fitContent();
    pushChartNotice('전체 구간 맞춤');
  }

  function toggleAutoScaleY() {
    autoScaleY = !autoScaleY;
    try { chart?.priceScale('right').applyOptions({ autoScale: autoScaleY }); } catch {}
    pushChartNotice(autoScaleY ? 'Y-AUTO ON' : 'Y-AUTO OFF');
    renderDrawings();
  }

  function resetChartScale() {
    barSpacing = BAR_SPACING.DEFAULT;
    autoScaleY = true;
    applyTimeScale();
    try { chart?.priceScale('right').applyOptions({ autoScale: true }); } catch {}
    chart?.timeScale().fitContent();
    pushChartNotice('스케일 초기화');
    renderDrawings();
  }

  function toggleIndicator(key: IndicatorKey) {
    indicatorEnabled = { ...indicatorEnabled, [key]: !indicatorEnabled[key] };
    applyIndicatorVisibility();
    gtmEvent('terminal_indicator_toggle', { indicator: key, enabled: indicatorEnabled[key] });
  }

  function setChartVisualMode(mode: 'focus' | 'full') {
    if (chartVisualMode === mode) return;
    chartVisualMode = mode;
    gtmEvent('terminal_chart_visual_mode', { mode });
  }

  function toggleIndicatorLegend() {
    showIndicatorLegend = !showIndicatorLegend;
    gtmEvent('terminal_indicator_legend_toggle', { show: showIndicatorLegend });
  }

  function setIndicatorStripState(next: 'expanded' | 'collapsed' | 'hidden') {
    if (isTvLikePreset && next !== 'collapsed') return;
    if (indicatorStripState === next) return;
    indicatorStripState = next;
    gtmEvent('terminal_indicator_strip_state', { state: next });
  }

  $effect(() => {
    if (isTvLikePreset) {
      if (indicatorStripState !== 'hidden') indicatorStripState = 'hidden';
      if (showIndicatorLegend) showIndicatorLegend = false;
    }
  });

  $effect(() => {
    if (!pendingTradePlan) {
      unbindRatioDrag();
    }
  });

  $effect(() => {
    const profileKey = advancedMode ? `advanced:${chartVisualMode}` : 'basic';
    if (_indicatorProfileApplied !== profileKey) {
      _indicatorProfileApplied = profileKey;
      applyIndicatorProfile();
      applyIndicatorVisibility();
    }
  });

  // OI/OBV removed — 3-pane layout (candles, volume, RSI) for stability
  // computeSMA and computeRSI imported from $lib/chart/chartIndicators

  // ═══════════════════════════════════════════
  //  TRADINGVIEW WIDGET
  // ═══════════════════════════════════════════

  function initTradingView(useSafeMode = false) {
    if (!tvContainer) return;
    if (_tvLoadTimer) { clearTimeout(_tvLoadTimer); _tvLoadTimer = null; }
    tvError = '';
    tvLoading = true;
    tvSafeMode = useSafeMode;
    try {
      const activeTheme = resolveChartTheme(tvContainer || chartContainer);
      chartTheme = activeTheme;
      tvScriptLoaded = false;
      destroyTradingView();
      const widgetDiv = tvContainer.querySelector<HTMLElement>('#tradingview_widget');
      if (!widgetDiv) return;

      const handleTvFailure = (reason: 'timeout' | 'network') => {
        if (_tvLoadTimer) { clearTimeout(_tvLoadTimer); _tvLoadTimer = null; }
        if (!useSafeMode && !_tvFallbackTried) {
          _tvFallbackTried = true;
          gtmEvent('terminal_tradingview_fallback_start', { reason, pair: storeState.pair, timeframe: storeState.timeframe });
          initTradingView(true);
          return;
        }
        tvLoading = false;
        tvError = 'TradingView 연결 실패. 네트워크/확장프로그램 차단 가능성이 있습니다.';
        gtmEvent('terminal_tradingview_error', { reason, mode: useSafeMode ? 'safe' : 'primary', pair: storeState.pair, timeframe: storeState.timeframe });
      };

      tvWidget = mountTradingViewEmbed(widgetDiv, {
        pair: storeState.pair,
        timeframe: storeState.timeframe,
        useSafeMode,
        theme: {
          bg: toTvHex(activeTheme.bg),
          grid: activeTheme.grid,
          candleUp: activeTheme.candleUp,
          candleDown: activeTheme.candleDown,
        },
      }, {
        onLoad: () => {
          if (_tvLoadTimer) { clearTimeout(_tvLoadTimer); _tvLoadTimer = null; }
          tvLoading = false;
          tvScriptLoaded = true;
          tvError = '';
          gtmEvent('terminal_tradingview_loaded', { mode: useSafeMode ? 'safe' : 'primary', pair: storeState.pair, timeframe: storeState.timeframe });
        },
        onError: () => { handleTvFailure('network'); },
      });
      _tvLoadTimer = setTimeout(() => {
        if (!tvScriptLoaded) handleTvFailure('timeout');
      }, 10000);
    } catch (e) {
      console.error('[ChartPanel] TV init error:', e);
      tvLoading = false;
      tvError = 'TradingView 초기화 실패';
      gtmEvent('terminal_tradingview_error', { reason: 'init_exception', mode: useSafeMode ? 'safe' : 'primary', pair: storeState.pair, timeframe: storeState.timeframe });
    }
  }

  function destroyTradingView() {
    if (_tvLoadTimer) { clearTimeout(_tvLoadTimer); _tvLoadTimer = null; }
    tvWidget = destroyTradingViewEmbed(tvWidget);
  }

  async function setChartMode(mode: 'agent' | 'trading') {
    if (mode === chartMode) return;
    chartMode = mode;
    gtmEvent('terminal_chart_mode_change', { mode });
    await tick(); await tick();
    if (mode === 'trading') {
      _tvFallbackTried = false;
      tvError = '';
      tvSafeMode = false;
      _tvReinitKey = '';
    } else {
      destroyTradingView();
      tvError = '';
      tvSafeMode = false;
      _tvReinitKey = '';
      if (_tvInitTimer) { clearTimeout(_tvInitTimer); _tvInitTimer = null; }
      await tick();
      if (chart && chartContainer) { chart.resize(chartContainer.clientWidth, chartContainer.clientHeight); chart.timeScale().fitContent(); }
    }
  }

  // Debounced TradingView init/re-init only when pair/TF key changes.
  let _tvInitTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (chartMode === 'trading' && tvContainer && storeState.pair && storeState.timeframe) {
      const key = `${storeState.pair}|${storeState.timeframe}`;
      if (key !== _tvReinitKey) {
        _tvReinitKey = key;
        if (_tvInitTimer) clearTimeout(_tvInitTimer);
        _tvInitTimer = setTimeout(() => {
          _tvFallbackTried = false;
          initTradingView(false);
        }, 220);
      }
    }
  });

  function retryTradingView() {
    _tvFallbackTried = false;
    tvError = '';
    gtmEvent('terminal_tradingview_retry', { pair: storeState.pair, timeframe: storeState.timeframe });
    initTradingView(false);
  }

  // ═══════════════════════════════════════════
  //  DRAWING TOOLS
  // ═══════════════════════════════════════════

  let _globalDrawingMouseUpBound = false;

  function bindGlobalDrawingMouseUp() {
    if (_globalDrawingMouseUpBound || typeof window === 'undefined') return;
    window.addEventListener('mouseup', handleDrawingMouseUp);
    _globalDrawingMouseUpBound = true;
  }

  function unbindGlobalDrawingMouseUp() {
    if (!_globalDrawingMouseUpBound || typeof window === 'undefined') return;
    window.removeEventListener('mouseup', handleDrawingMouseUp);
    _globalDrawingMouseUpBound = false;
  }

  function setDrawingMode(mode: DrawingMode) {
    drawingMode = mode;
    isDrawing = false;
    currentDrawing = null;
    tradePreview = null;
    if (mode !== 'none') pendingTradePlan = null;
    unbindGlobalDrawingMouseUp();
    renderDrawings();
  }
  function toggleDrawingsVisible() {
    drawingsVisible = !drawingsVisible;
    renderDrawings();
  }
  function clearAllDrawings() {
    drawings = [];
    currentDrawing = null;
    tradePreview = null;
    pendingTradePlan = null;
    isDrawing = false;
    drawingMode = 'none';
    unbindGlobalDrawingMouseUp();
    renderDrawings();
  }

  function handleDrawingMouseDown(e: MouseEvent) {
    if (!drawingCanvas) return;
    const rect = drawingCanvas.getBoundingClientRect();
    if (drawingMode === 'none') return;
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (drawingMode === 'hline') {
      const linePrice = toChartPrice(y);
      drawings = appendDrawingWithLimit(
        drawings,
        buildHorizontalLineDrawing({
          y,
          width: rect.width,
          linePrice,
          color: chartTheme.draw,
        }),
        MAX_DRAWINGS,
      );
      renderDrawings(); drawingMode = 'none'; return;
    }
    if (drawingMode === 'trendline') {
      if (!isDrawing) { currentDrawing = startTrendlineDraft(x, y); isDrawing = true; }
      else if (currentDrawing) {
        const startPoint = currentDrawing.points[0];
        const endPoint = { x, y };
        const startAnchor = toDrawingAnchor(startPoint.x, startPoint.y);
        const endAnchor = toDrawingAnchor(endPoint.x, endPoint.y);
        drawings = appendDrawingWithLimit(
          drawings,
          completeTrendlineDraft({
            draft: currentDrawing,
            endPoint,
            startAnchor,
            endAnchor,
            color: chartTheme.draw,
          }),
          MAX_DRAWINGS,
        );
        currentDrawing = null; isDrawing = false; drawingMode = 'none'; renderDrawings();
      }
      return;
    }
    if (isTradePreviewMode(drawingMode)) {
      tradePreview = startTradePreviewDraft(drawingMode, x, y);
      currentDrawing = null;
      isDrawing = true;
      bindGlobalDrawingMouseUp();
      renderDrawings();
      return;
    }
  }

  function handleDrawingMouseUp(e: MouseEvent) {
    if (!drawingCanvas || !isDrawing || !tradePreview) return;
    if (!isTradePreviewMode(drawingMode)) return;
    const rect = drawingCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const preview = resolveTradePreview({
      tradePreview,
      drawingMode,
      cursor: { x, y },
      canvasW: rect.width,
      canvasH: rect.height,
      coord: { toChartPrice, toChartY },
      livePrice,
    });
    if (!preview) {
      pushChartNotice('라인 진입 계산 실패');
    } else {
      const finalized = finalizeTradePreview({
        drawings,
        nextDrawing: makeTradeBoxDrawing(preview),
        preview,
        pair: storeState.pair || 'BTC/USDT',
        requireTradeConfirm,
        maxDrawings: MAX_DRAWINGS,
      });
      drawings = finalized.drawings;
      if (finalized.pendingTradePlan) {
        pendingTradePlan = finalized.pendingTradePlan;
        pushChartNotice('Drag complete — adjust ratio and confirm');
      } else if (finalized.lineTrade) {
        openQuickTrade(
          finalized.lineTrade.pair,
          finalized.lineTrade.dir,
          finalized.lineTrade.entry,
          finalized.lineTrade.tp,
          finalized.lineTrade.sl,
          'chart-line',
          `${finalized.lineTrade.dir} line-entry`,
        );
        gtmEvent('terminal_line_entry_open', {
          pair: finalized.lineTrade.pair,
          dir: finalized.lineTrade.dir,
          entry: finalized.lineTrade.entry,
          tp: finalized.lineTrade.tp,
          sl: finalized.lineTrade.sl,
          rr: finalized.lineTrade.rr,
        });
        pushChartNotice(
          `${finalized.lineTrade.dir} 진입 생성 · ENTRY ${formatPrice(finalized.lineTrade.entry)} · TP ${formatPrice(finalized.lineTrade.tp)} · SL ${formatPrice(finalized.lineTrade.sl)} · RR 1:${finalized.lineTrade.rr.toFixed(1)}`
        );
      } else {
        pushChartNotice('라인 기준 가격 계산 실패');
      }
    }
    isDrawing = false;
    currentDrawing = null;
    tradePreview = null;
    drawingMode = 'none';
    unbindGlobalDrawingMouseUp();
    renderDrawings();
  }

  let _drawRAF: number | null = null;
  function handleDrawingMouseMove(e: MouseEvent) {
    if (!drawingCanvas) return;
    if (!isDrawing) return;
    if (_drawRAF) return; // throttle to animation frame
    _drawRAF = requestAnimationFrame(() => {
      _drawRAF = null;
      if (!drawingCanvas) return;
      const rect = drawingCanvas.getBoundingClientRect();
      if (tradePreview && isTradePreviewMode(drawingMode)) {
        tradePreview = updateTradePreviewDraft(tradePreview, e.clientX - rect.left, e.clientY - rect.top);
        renderDrawings();
        return;
      }
      if (!currentDrawing) return;
      renderDrawings();
      if (!_drawCtx) _drawCtx = drawingCanvas.getContext('2d');
      const ctx = _drawCtx;
      if (!ctx) return;
      drawTrendlineGhost(
        ctx,
        currentDrawing,
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        chartTheme.drawGhost,
      );
    });
  }

  function renderDrawings() {
    if (!drawingCanvas) return;
    if (!_drawCtx) _drawCtx = drawingCanvas.getContext('2d');
    const ctx = _drawCtx;
    if (!ctx) return;
    const { agentCloseBtn } = renderChartOverlay({
      ctx,
      canvasW: drawingCanvas.width,
      canvasH: drawingCanvas.height,
      chartMode,
      overlayPatterns,
      activeTradeSetup,
      drawingsVisible,
      drawings,
      drawingMode,
      tradePreview,
      chartTheme,
      livePrice,
      coord: { toChartX, toChartY, toChartPrice, toOverlayPoint },
    });
    _agentCloseBtn = agentCloseBtn;
  }

  function toOverlayPoint(time: number, price: number): { x: number; y: number } | null {
    if (!chart || !drawingCanvas) return null;
    if (!Number.isFinite(time) || !Number.isFinite(price)) return null;
    try {
      const x = chart.timeScale().timeToCoordinate(time as any) as number | null;
      const y = toChartY(price);
      if (x === null || !Number.isFinite(x) || y === null || !Number.isFinite(y)) return null;
      return { x, y };
    } catch {
      return null;
    }
  }

  function resizeDrawingCanvas() {
    if (!drawingCanvas || !chartContainer) return;
    drawingCanvas.width = chartContainer.clientWidth;
    drawingCanvas.height = chartContainer.clientHeight;
    _drawCtx = null; // invalidate cached context on resize
    renderDrawings();
  }

  function clearPatternLineSeries() {
    if (!chart || patternLineSeries.length === 0) {
      patternLineSeries = [];
      return;
    }
    for (const lineSeries of patternLineSeries) {
      try { chart.removeSeries(lineSeries); } catch {}
    }
    patternLineSeries = [];
  }

  function applyPatternLineSeries() {
    // Pattern guides are already drawn on the overlay canvas.
    // Keep lightweight-charts line series off to prevent duplicate/double lines.
    if (!ENABLE_PATTERN_LINE_SERIES) {
      clearPatternLineSeries();
      return;
    }
    if (!chart || !lwcModule) return;
    clearPatternLineSeries();
    if (overlayPatterns.length === 0) return;

    for (const pattern of overlayPatterns) {
      for (const guide of pattern.guideLines) {
        try {
          const lineSeries = chart.addSeries(lwcModule.LineSeries, {
            color: guide.color,
            lineWidth: (pattern.status === 'CONFIRMED' ? 2 : 1.5) as any,
            lineStyle: guide.style === 'dashed' ? 2 : 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          lineSeries.setData([
            { time: guide.from.time as any, value: guide.from.price },
            { time: guide.to.time as any, value: guide.to.price },
          ]);
          patternLineSeries.push(lineSeries);
        } catch (err) {
          console.error('[ChartPanel] pattern line render error', err);
        }
      }
    }
  }

  // toPatternMarker — imported from chart/chartPatternEngine.ts

  function applyCombinedMarkers() {
    if (!series) return;
    try {
      (series as any).setMarkers([...agentMarkers, ...patternMarkers]);
    } catch {}
  }

  function applyPatternStateSnapshot(
    nextState: ChartPatternStateSnapshot,
    options: { force?: boolean } = {}
  ) {
    if (!options.force && nextState.signature === _patternSignature) return;
    _patternSignature = nextState.signature;
    detectedPatterns = nextState.detectedPatterns;
    overlayPatterns = nextState.overlayPatterns;
    patternMarkers = nextState.patternMarkers;
    applyCombinedMarkers();
    applyPatternLineSeries();
    renderDrawings();
  }

  function clearDetectedPatterns() {
    applyPatternStateSnapshot(emptyChartPatternState(), { force: true });
  }

  function getVisibleLogicalRange(): { from: number; to: number } | null {
    if (!chart) return null;
    try {
      const range = chart.timeScale?.().getVisibleLogicalRange?.();
      if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
      return { from: range.from, to: range.to };
    } catch {
      return null;
    }
  }

  function scheduleVisiblePatternScan() {
    if (_patternRangeScanTimer) clearTimeout(_patternRangeScanTimer);
    _patternRangeScanTimer = setTimeout(() => {
      _patternRangeScanTimer = null;
      runPatternDetection('visible', { fallbackToFull: true });
    }, 120);
  }

  function runPatternDetection(
    scope: PatternScanScope = 'visible',
    opts: { fallbackToFull?: boolean } = {}
  ): PatternScanReport {
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
    const visibleCandles = sliceVisibleScopeCandles(klineCache, getVisibleLogicalRange());
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

  function focusPatternRange(pattern: ChartPatternDetection) {
    if (!chart) return;
    const span = Math.max(1, pattern.endTime - pattern.startTime);
    const from = Math.max(0, pattern.startTime - Math.round(span * 0.25));
    const to = pattern.endTime + Math.round(span * 0.35);
    try {
      chart.timeScale().setVisibleRange({ from, to } as any);
    } catch {}
  }

  function forcePatternScan() {
    const result = runPatternDetection('visible');
    pushChartNotice(result.message);
  }

  export async function runPatternScanFromIntel(options: { scope?: PatternScanScope; focus?: boolean } = {}): Promise<PatternScanReport> {
    const scope = options.scope ?? 'visible';
    if (chartMode !== 'agent') {
      await setChartMode('agent');
      await tick();
    }

    const result = runPatternDetection(scope);
    if ((options.focus ?? true) && overlayPatterns.length > 0) {
      focusPatternRange(overlayPatterns[0]);
      renderDrawings();
    }
    pushChartNotice(result.message);
    gtmEvent('terminal_pattern_scan_from_intel', {
      pair: storeState.pair,
      timeframe: storeState.timeframe,
      scope: result.scope,
      candle_count: result.candleCount,
      pattern_count: result.patternCount,
    });
    return result;
  }

  // ═══════════════════════════════════════════
  //  PRICE & POSITION
  // ═══════════════════════════════════════════

  let livePrice = $state(0);
  let priceChange24h = $state(0);
  let high24h = $state(0);
  let low24h = $state(0);
  let quoteVolume24h = $state(0);
  let isLoading = $state(true);
  let error = $state('');

  let _priceUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  let _pendingPrice: number | null = null;
  let _pendingPairBase: string | null = null;

  /** priceStore에 즉시 반영 (초기 로드 시 호출) */
  function flushPriceUpdate(price: number, pairBase: string) {
    const normalized = normalizeMarketPrice(price);
    updatePrice(pairBase, normalized, 'rest');
  }

  /** WS 실시간 업데이트용 2초 스로틀 (pairBase도 함께 저장하여 클로저 버그 방지) */
  function throttledPriceUpdate(price: number, pairBase: string) {
    _pendingPrice = price;
    _pendingPairBase = pairBase;
    if (_priceUpdateTimer) return;
    _priceUpdateTimer = setTimeout(() => {
      if (_pendingPrice !== null && _pendingPairBase !== null) {
        const normalized = normalizeMarketPrice(_pendingPrice!);
        // S-03: priceStore가 단일 소스
        updatePrice(_pendingPairBase!, normalized, 'ws');
      }
      _priceUpdateTimer = null; _pendingPrice = null; _pendingPairBase = null;
    }, 2000);
  }

  function hydrate24hStatsFromKlines(klines: BinanceKline[]) {
    const stats = compute24hStatsFromKlines(klines);
    if (stats.high !== null) high24h = stats.high;
    if (stats.low !== null) low24h = stats.low;
    if (stats.quoteVolume !== null) quoteVolume24h = stats.quoteVolume;
  }

  $effect(() => { if (series && showPosition && posEntry !== null && posTp !== null && posSl !== null) { updatePositionLines(posEntry, posTp, posSl, posDir); } });
  $effect(() => { if (series && !showPosition) { clearPositionLines(); } });
  $effect(() => { if (series) { applyAgentTradeSetup(activeTradeSetup); } });

  function updatePositionLines(entry: number, tp: number, sl: number, dir: string) {
    if (!series) return;
    clearPositionLines();
    const isLong = dir === 'LONG';
    tpLine = series.createPriceLine({ price: tp, color: chartTheme.tp, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `TP ${isLong ? '▲' : '▼'} $${Math.round(tp).toLocaleString()}` });
    entryLine = series.createPriceLine({ price: entry, color: chartTheme.entry, lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: `ENTRY $${Math.round(entry).toLocaleString()}` });
    slLine = series.createPriceLine({ price: sl, color: chartTheme.sl, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `SL ${isLong ? '▼' : '▲'} $${Math.round(sl).toLocaleString()}` });
  }

  function clearPositionLines() {
    if (tpLine && series) { try { series.removePriceLine(tpLine); } catch {} tpLine = null; }
    if (entryLine && series) { try { series.removePriceLine(entryLine); } catch {} entryLine = null; }
    if (slLine && series) { try { series.removePriceLine(slLine); } catch {} slLine = null; }
  }

  // ═══ Drag TP/SL ═══
  let isDragging: 'tp' | 'sl' | 'entry' | null = $state(null);
  let hoverLine: 'tp' | 'sl' | 'entry' | null = $state(null);

  function handleChartMouseDown(e: MouseEvent) {
    if (!chart || !series || !showPosition || posEntry === null || posTp === null || posSl === null) return;
    const y = e.clientY - chartContainer.getBoundingClientRect().top;
    const price = priceFromY(y);
    if (price === null) return;
    const distTP = Math.abs(price - (posTp || 0)), distSL = Math.abs(price - (posSl || 0)), distEntry = Math.abs(price - (posEntry || 0));
    const minDist = Math.min(distTP, distSL, distEntry);
    const threshold = Math.abs((posTp || 0) - (posSl || 0)) * 0.15;
    if (minDist > threshold) return;
    isDragging = minDist === distTP ? 'tp' : minDist === distSL ? 'sl' : 'entry';
    chartContainer.style.cursor = 'ns-resize'; e.preventDefault();
  }

  function handleChartMouseMove(e: MouseEvent) {
    if (!chart || !series) return;
    const y = e.clientY - chartContainer.getBoundingClientRect().top;
    const price = priceFromY(y);
    if (price === null) return;
    if (isDragging) {
      emitDrag(isDragging === 'tp' ? 'dragTP' : isDragging === 'sl' ? 'dragSL' : 'dragEntry', { price: Math.round(price) });
    } else if (showPosition && posEntry !== null && posTp !== null && posSl !== null) {
      const distTP = Math.abs(price - (posTp || 0)), distSL = Math.abs(price - (posSl || 0)), distEntry = Math.abs(price - (posEntry || 0));
      const minDist = Math.min(distTP, distSL, distEntry);
      const threshold = Math.abs((posTp || 0) - (posSl || 0)) * 0.15;
      if (minDist <= threshold) { hoverLine = minDist === distTP ? 'tp' : minDist === distSL ? 'sl' : 'entry'; chartContainer.style.cursor = 'ns-resize'; }
      else { hoverLine = null; chartContainer.style.cursor = ''; }
    }
  }

  function handleChartMouseUp() { if (isDragging) { isDragging = null; hoverLine = null; chartContainer.style.cursor = ''; } }

  function handleChartWheel(e: WheelEvent) {
    if (!chart || !series || !showPosition || posEntry === null || posTp === null || posSl === null) return;
    const target = hoverLine || isDragging;
    if (!target) return;
    e.preventDefault(); e.stopPropagation();
    const basePrice = posEntry || livePrice;
    const step = basePrice > 10000 ? 10 : basePrice > 1000 ? 1 : basePrice > 100 ? 0.5 : 0.1;
    const delta = e.deltaY > 0 ? -step : step;
    const val = target === 'tp' ? posTp : target === 'sl' ? posSl : posEntry;
    emitDrag(target === 'tp' ? 'dragTP' : target === 'sl' ? 'dragSL' : 'dragEntry', { price: Math.round((val || 0) + delta) });
  }

  function priceFromY(y: number): number | null { if (!series) return null; try { return series.coordinateToPrice(y); } catch { return null; } }

  $effect(() => { if (series) { applyCombinedMarkers(); } });

  export function getCurrentPrice() { return livePrice; }

  // ═══════════════════════════════════════════
  //  CHART INIT & DATA LOADING
  // ═══════════════════════════════════════════

  onMount(async () => {
    try {
      lwcModule = await import('lightweight-charts');
      const lwc = lwcModule;
      chartTheme = resolveChartTheme(chartContainer);

      if (advancedMode && indicatorStripState === 'expanded') {
        indicatorStripState = 'collapsed';
        showIndicatorLegend = false;
        chartVisualMode = 'focus';
      }

      if (_indicatorProfileApplied === null) {
        applyIndicatorProfile();
        _indicatorProfileApplied = advancedMode ? `advanced:${chartVisualMode}` : 'basic';
      }

      const compactViewport = isCompactViewport();
      chart = lwc.createChart(chartContainer, {
        width: chartContainer.clientWidth, height: chartContainer.clientHeight,
        layout: {
          background: { type: lwc.ColorType.Solid, color: chartTheme.bg },
          textColor: chartTheme.text,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: compactViewport ? 12 : 11
        },
        grid: { vertLines: { color: chartTheme.grid }, horzLines: { color: chartTheme.grid } },
        crosshair: {
          mode: lwc.CrosshairMode.Normal,
          vertLine: { labelBackgroundColor: withAlpha('#122031', 0.94) },
          horzLine: { labelBackgroundColor: withAlpha('#122031', 0.94) }
        },
        rightPriceScale: {
          autoScale: true,
          borderColor: chartTheme.border,
          minimumWidth: compactViewport ? 88 : 74,
          scaleMargins: { top: 0.04, bottom: 0.08 }
        },
        timeScale: {
          borderColor: chartTheme.border,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 6,
          barSpacing,
          minBarSpacing: 3
        },
        handleScale: {
          axisPressedMouseMove: { time: true, price: true },
          mouseWheel: true,
          pinch: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        }
      });

      series = chart.addSeries(lwc.CandlestickSeries, {
        upColor: chartTheme.candleUp,
        downColor: chartTheme.candleDown,
        wickUpColor: chartTheme.candleUp,
        wickDownColor: chartTheme.candleDown,
        borderVisible: true,
        borderUpColor: withAlpha(chartTheme.candleUp, 1),
        borderDownColor: withAlpha(chartTheme.candleDown, 1)
      });

      // MA lines on main pane
      const maOpts = (color: string, lineWidth = 1, lineStyle = 0) => ({
        color,
        lineWidth: lineWidth as any,
        lineStyle,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      });
      ma7Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma7, 1, 2));
      ma20Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma20, 2, 0));
      ma25Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma25, 1, 2));
      ma60Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma60, 2, 0));
      ma99Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma99, 1, 2));
      ma120Series = chart.addSeries(lwc.LineSeries, maOpts(chartTheme.ma120, 2, 0));

      // Rebuild _maPeriods with fresh series refs (no $: reactive — only needed after series creation)
      _maPeriods = [
        { p: 7, s: ma7Series, setVal: (v: number) => { ma7Val = v; } },
        { p: 20, s: ma20Series, setVal: (v: number) => { ma20Val = v; } },
        { p: 25, s: ma25Series, setVal: (v: number) => { ma25Val = v; } },
        { p: 60, s: ma60Series, setVal: (v: number) => { ma60Val = v; } },
        { p: 99, s: ma99Series, setVal: (v: number) => { ma99Val = v; } },
        { p: 120, s: ma120Series, setVal: (v: number) => { ma120Val = v; } },
      ];

      // ═══ Volume Pane ═══
      chart.addPane();
      const volIdx = chart.panes().length - 1;
      volumePaneIndex = volIdx;
      volumeSeries = chart.addSeries(lwc.HistogramSeries, { priceFormat: { type: 'volume' }, lastValueVisible: true, priceLineVisible: false }, volIdx);
      chart.panes()[volIdx].setStretchFactor(0.12);

      // ═══ RSI Pane ═══
      chart.addPane();
      const rsiIdx = chart.panes().length - 1;
      rsiPaneIndex = rsiIdx;
      rsiSeries = chart.addSeries(lwc.LineSeries, {
        color: chartTheme.rsi,
        lineWidth: 1.5 as any,
        priceLineVisible: true,
        lastValueVisible: true,
        crosshairMarkerVisible: false
      }, rsiIdx);
      rsiSeries.createPriceLine({ price: 70, color: chartTheme.rsiTop, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
      rsiSeries.createPriceLine({ price: 30, color: chartTheme.rsiBottom, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
      rsiSeries.createPriceLine({ price: 50, color: chartTheme.rsiMid, lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: '' });
      chart.panes()[rsiIdx].setStretchFactor(0.12);
      applyTimeScale();
      applyIndicatorVisibility();

      await loadKlines();

      // ═══ Lazy-load: detect scroll to left edge ═══
      const onVisibleLogicalRangeChange = (range: any) => {
        if (range && range.from < 20 && !_isLoadingMore && !_noMoreHistory) {
          loadMoreHistory();
        }
        scheduleVisiblePatternScan();
        renderDrawings();
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange);
      let _crosshairRAF: number | null = null;
      const onCrosshairMove = () => {
        if (_crosshairRAF) return;
        _crosshairRAF = requestAnimationFrame(() => { _crosshairRAF = null; renderDrawings(); });
      };
      chart.subscribeCrosshairMove(onCrosshairMove);

      const ro = new ResizeObserver(() => {
        if (chart && chartMode === 'agent') chart.resize(chartContainer.clientWidth, chartContainer.clientHeight);
        resizeDrawingCanvas();
      });
      ro.observe(chartContainer);

      const onKeyDown = (e: KeyboardEvent) => {
        if (chartMode !== 'agent') return;
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        const k = e.key.toLowerCase();
        if (k === 'escape') setDrawingMode('none');
        else if (k === '=' || k === '+') zoomChart(1);
        else if (k === '-' || k === '_') zoomChart(-1);
        else if (k === '0') resetChartScale();
        else if (k === 'f') fitChartRange();
        else if (k === 'v') toggleDrawingsVisible();
        else if (k === 'h') setDrawingMode('hline');
        else if (k === 't') setDrawingMode('trendline');
        else if (enableTradeLineEntry && k === 'r') setDrawingMode('trade');
        else if (enableTradeLineEntry && k === 'l') setDrawingMode('longentry');
        else if (enableTradeLineEntry && k === 's') setDrawingMode('shortentry');
      };
      window.addEventListener('keydown', onKeyDown);

      cleanup = () => {
        ro.disconnect();
        window.removeEventListener('keydown', onKeyDown);
        if (wsCleanup) wsCleanup();
        if (priceWsCleanup) priceWsCleanup();
        clearPositionLines();
        clearPatternLineSeries();
        try { chart?.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChange); } catch {}
        try { chart?.unsubscribeCrosshairMove(onCrosshairMove); } catch {}
        destroyTradingView();
        if (chart) chart.remove();
      };
    } catch (e) { error = 'Chart initialization failed'; console.error(e); }
  });

  // ═══ Lazy-load older candles when user scrolls left ═══
  async function loadMoreHistory() {
    if (_isLoadingMore || _noMoreHistory || !series || !chart || klineCache.length === 0) return;
    _isLoadingMore = true;

    try {
      const earliest = klineCache[0];
      const endTimeMs = earliest.time * 1000 - 1; // just before the earliest candle
      const older = await fetchKlines(_currentSymbol, _currentInterval, 1000, endTimeMs);
      if (!series || !chart || older.length === 0) { _noMoreHistory = true; _isLoadingMore = false; return; }

      // Deduplicate: remove any overlap
      const earliestTime = earliest.time;
      const unique = older.filter(k => k.time < earliestTime);
      if (unique.length === 0) { _noMoreHistory = true; _isLoadingMore = false; return; }

      // Prepend to cache (cap at MAX_KLINE_CACHE to prevent unbounded growth)
      klineCache = [...unique, ...klineCache];
      if (klineCache.length > MAX_KLINE_CACHE) {
        klineCache = klineCache.slice(-MAX_KLINE_CACHE);
      }

      // Re-set all series data
      series.setData(klineCache.map(k => ({ time: k.time as any, open: k.open, high: k.high, low: k.low, close: k.close })));
      if (volumeSeries) volumeSeries.setData(klineCache.map(k => ({
        time: k.time as any,
        value: k.volume,
        color: k.close >= k.open ? chartTheme.volumeUp : chartTheme.volumeDown
      })));

      const closes = klineCache.map(k => ({ time: k.time, close: k.close }));
      if (ma7Series) ma7Series.setData(computeSMA(closes, 7) as any);
      if (ma20Series) ma20Series.setData(computeSMA(closes, 20) as any);
      if (ma25Series) ma25Series.setData(computeSMA(closes, 25) as any);
      if (ma60Series) ma60Series.setData(computeSMA(closes, 60) as any);
      if (ma99Series) ma99Series.setData(computeSMA(closes, 99) as any);
      if (ma120Series) ma120Series.setData(computeSMA(closes, 120) as any);
      if (rsiSeries) {
        const { result: rsiData, state: rsiState } = computeRSI(closes, 14);
        _rsiAvgGain = rsiState.avgGain;
        _rsiAvgLoss = rsiState.avgLoss;
        rsiSeries.setData(rsiData as any);
        if (rsiData.length > 0) rsiVal = rsiData[rsiData.length - 1].value;
      }
      latestVolume = klineCache[klineCache.length - 1]?.volume || 0;
      runPatternDetection('visible', { fallbackToFull: true });
      // Don't call fitContent — preserve user's scroll position
    } catch (e) {
      console.error('[ChartPanel] loadMoreHistory error:', e);
    }
    _isLoadingMore = false;
  }

  async function loadKlines(overrideSymbol?: string, overrideInterval?: string) {
    if (!series || !volumeSeries || !chart) return;
    const sym = overrideSymbol || symbol;
    const intv = overrideInterval || interval;
    const pairBase = (storeState.pair.split('/')[0] || 'BTC').toUpperCase();
    _currentSymbol = sym;
    _currentInterval = intv;
    _noMoreHistory = false;
    clearDetectedPatterns();
    // Cleanup stale timers from previous pair/TF
    if (_patternRangeScanTimer) { clearTimeout(_patternRangeScanTimer); _patternRangeScanTimer = null; }
    if (_priceUpdateTimer) { clearTimeout(_priceUpdateTimer); _priceUpdateTimer = null; _pendingPrice = null; _pendingPairBase = null; }
    if (_drawRAF) { cancelAnimationFrame(_drawRAF); _drawRAF = null; }
    isLoading = true; error = '';

    try {
      const [klines, ticker24] = await Promise.all([
        fetchKlines(sym, intv, 1000),
        fetch24hr(sym).catch(() => null)
      ]);
      if (!series || !chart) return;
      if (klines.length === 0) { error = 'No data received'; isLoading = false; return; }

      // Candles
      series.setData(klines.map(k => ({ time: k.time as any, open: k.open, high: k.high, low: k.low, close: k.close })));

      // Volume
      if (volumeSeries) volumeSeries.setData(klines.map(k => ({
        time: k.time as any,
        value: k.volume,
        color: k.close >= k.open ? chartTheme.volumeUp : chartTheme.volumeDown
      })));

      // ═══ Indicators ═══
      klineCache = klines;
      const closes = klines.map(k => ({ time: k.time, close: k.close }));

      // Compute SMA series + extract last value for display (avoids duplicate slice/reduce)
      const maSeries = [
        { period: 7, s: ma7Series },
        { period: 20, s: ma20Series },
        { period: 25, s: ma25Series },
        { period: 60, s: ma60Series },
        { period: 99, s: ma99Series },
        { period: 120, s: ma120Series },
      ];
      const maLastValues: Record<number, number> = {};
      for (const { period, s } of maSeries) {
        const smaData = computeSMA(closes, period);
        if (s) s.setData(smaData as any);
        maLastValues[period] = smaData.length > 0 ? smaData[smaData.length - 1].value : 0;
      }
      ma7Val = maLastValues[7]; ma20Val = maLastValues[20]; ma25Val = maLastValues[25];
      ma60Val = maLastValues[60]; ma99Val = maLastValues[99]; ma120Val = maLastValues[120];

      // Seed running sums for O(1) WS MA updates
      _maRunSum = {};
      for (const p of [7, 20, 25, 60, 99, 120]) {
        if (klines.length >= p) {
          let s = 0;
          for (let i = klines.length - p; i < klines.length; i++) s += klines[i].close;
          _maRunSum[p] = s;
        }
      }

      if (rsiSeries) {
        const { result: rsiData, state: rsiState } = computeRSI(closes, 14);
        _rsiAvgGain = rsiState.avgGain;
        _rsiAvgLoss = rsiState.avgLoss;
        rsiSeries.setData(rsiData as any);
        if (rsiData.length > 0) rsiVal = rsiData[rsiData.length - 1].value;
      }
      runPatternDetection('visible', { fallbackToFull: true });

      const len = klines.length;
      const lastKline = klines[len - 1];
      latestVolume = lastKline.volume;
      livePrice = lastKline.close;
      if (ticker24 && Number.isFinite(Number(ticker24.priceChangePercent))) {
        priceChange24h = Number(ticker24.priceChangePercent);
        const parsedHigh = Number((ticker24 as any).highPrice);
        const parsedLow = Number((ticker24 as any).lowPrice);
        const parsedQuoteVol = Number((ticker24 as any).quoteVolume);
        if (Number.isFinite(parsedHigh) && parsedHigh > 0) high24h = parsedHigh;
        if (Number.isFinite(parsedLow) && parsedLow > 0) low24h = parsedLow;
        if (Number.isFinite(parsedQuoteVol) && parsedQuoteVol > 0) quoteVolume24h = parsedQuoteVol;
      } else if (len > 6) {
        priceChange24h = ((lastKline.close - klines[len - 7].close) / klines[len - 7].close) * 100;
        hydrate24hStatsFromKlines(klines);
      } else {
        hydrate24hStatsFromKlines(klines);
      }

      // 초기 kline 로드 시 즉시 priceStore에 반영 (Header 즉시 업데이트)
      flushPriceUpdate(lastKline.close, pairBase);
      emitPriceUpdate({ price: lastKline.close });
      chart.timeScale().fitContent();

      // ═══ WebSocket real-time ═══
      if (wsCleanup) wsCleanup();
      if (priceWsCleanup) {
        priceWsCleanup();
        priceWsCleanup = null;
      }
      wsCleanup = subscribeKlines(sym, intv, (kline: BinanceKline) => {
        if (!series) return;

        series.update({ time: kline.time as any, open: kline.open, high: kline.high, low: kline.low, close: kline.close });
        if (volumeSeries) {
          volumeSeries.update({
            time: kline.time as any,
            value: kline.volume,
            color: kline.close >= kline.open ? chartTheme.volumeUp : chartTheme.volumeDown
          });
        }

        // Update kline cache
        const isUpdate = klineCache.length > 0 && klineCache[klineCache.length - 1].time === kline.time;
        const prevClose = isUpdate ? (klineCache.length > 1 ? klineCache[klineCache.length - 2].close : kline.open) : klineCache[klineCache.length - 1]?.close ?? kline.open;
        if (isUpdate) klineCache[klineCache.length - 1] = kline;
        else {
          klineCache.push(kline);
          if (klineCache.length > MAX_KLINE_CACHE) klineCache = klineCache.slice(-MAX_KLINE_CACHE);
        }
        const cLen = klineCache.length;
        runPatternDetection('visible', { fallbackToFull: true });

        // MA — O(1) per period using running sums
        for (const { p, s, setVal } of _maPeriods) {
          if (!s || cLen < p) continue;
          if (isUpdate) {
            // Replace old close of current candle with new close
            _maRunSum[p] = (_maRunSum[p] ?? 0) - prevClose + kline.close;
          } else {
            // New candle: drop oldest, add newest
            _maRunSum[p] = (_maRunSum[p] ?? 0) - (klineCache[cLen - p - 1]?.close ?? 0) + kline.close;
          }
          const val = _maRunSum[p] / p;
          setVal(val);
          s.update({ time: kline.time as any, value: val });
        }

        // RSI — incremental Wilder smoothing (via imported helper)
        if (rsiSeries && cLen > 14) {
          const { value: rsi, state: rsiState } = updateRSIIncremental(
            { avgGain: _rsiAvgGain, avgLoss: _rsiAvgLoss },
            kline.close - prevClose,
          );
          _rsiAvgGain = rsiState.avgGain;
          _rsiAvgLoss = rsiState.avgLoss;
          rsiSeries.update({ time: kline.time as any, value: rsi });
          rsiVal = rsi;
        }

        livePrice = kline.close;
        latestVolume = kline.volume;
        throttledPriceUpdate(kline.close, pairBase);
        emitPriceUpdate({ price: kline.close });
      });

      // Keep displayed price synced to trade ticker (closer match with TradingView quote).
      priceWsCleanup = subscribeMiniTicker(
        [sym],
        (update) => {
          const tick = update[sym];
          if (!Number.isFinite(tick) || tick <= 0) return;
          livePrice = tick;
          throttledPriceUpdate(tick, pairBase);
          emitPriceUpdate({ price: tick });
        },
        (updates) => {
          const full = updates[sym];
          if (!full) return;
          if (Number.isFinite(full.change24h)) priceChange24h = full.change24h;
          if (Number.isFinite(full.high24h) && full.high24h > 0) high24h = full.high24h;
          if (Number.isFinite(full.low24h) && full.low24h > 0) low24h = full.low24h;
          if (Number.isFinite(full.volume24h) && full.volume24h > 0) quoteVolume24h = full.volume24h;
        }
      );

      isLoading = false;
    } catch (e: any) {
      console.error('[ChartPanel] API error:', e);
      error = `API Error: ${e.message || 'Failed'}`;
      isLoading = false;
      if (klineCache.length === 0) {
        const fallback = getPairPrice($livePrices, storeState.pair, pairBaseFallbackSymbol, pairBaseFallbackPrice);
        if (Number.isFinite(fallback) && fallback > 0) livePrice = fallback;
      }
    }
  }

  function loadFallbackData() {
    if (!series || !chart) return;
    const basePrice = getPairPrice($livePrices, storeState.pair, pairBaseFallbackSymbol, pairBaseFallbackPrice || 97000);
    const candles = generateCandles(201, basePrice);
    series.setData(candles as any);
    chart.timeScale().fitContent();
    livePrice = basePrice;
    const fallbackInterval = setInterval(() => {
      const last = candles[candles.length - 1];
      const change = (Math.random() - 0.48) * 80;
      const newClose = last.close + change;
      const time = (last.time as number) + 14400;
      const nc = { time, open: last.close, high: Math.max(last.close, newClose) + Math.random() * 40, low: Math.min(last.close, newClose) - Math.random() * 40, close: newClose };
      candles.push(nc); if (series) series.update(nc as any); livePrice = newClose;
      emitPriceUpdate({ price: newClose });
    }, 1500);
    if (cleanup) { const old = cleanup; cleanup = () => { clearInterval(fallbackInterval); old(); }; }
  }

  function changePair(pair: string) {
    gtmEvent('terminal_pair_change', { pair });
    pendingTradePlan = null;
    gameState.update(s => ({ ...s, pair }));
    loadKlines(pairToSymbol(pair), interval);
  }
  function changeTF(tf: string) {
    const normalized = normalizeTimeframe(tf);
    gtmEvent('terminal_timeframe_change', { timeframe: normalized });
    pendingTradePlan = null;
    gameState.update(s => ({ ...s, timeframe: normalized }));
    loadKlines(symbol, toBinanceInterval(normalized));
  }

  function requestAgentScan() {
    gtmEvent('terminal_scan_request_chart', {
      source: 'chart-bar',
      pair: storeState.pair,
      timeframe: storeState.timeframe,
    });
    emitScanRequest({
      source: 'chart-bar',
      pair: storeState.pair,
      timeframe: storeState.timeframe,
    });
  }

  function publishCommunitySignal(dir: 'LONG' | 'SHORT', options?: { openCopyTrade?: boolean; sourceContext?: string }) {
    const draft = buildCommunitySignalDraft({
      pair: storeState.pair || 'BTC/USDT',
      dir,
      livePrice,
      activeTradeSetup,
      timeframe: storeState.timeframe,
      chatTradeReady,
      chatTradeDir,
    });
    if (!draft) {
      pushChartNotice('시그널 생성 실패: 가격 데이터가 부족합니다');
      return;
    }

    const openCopyTrade = options?.openCopyTrade !== false;
    emitCommunitySignal({
      pair: draft.pair,
      dir: draft.dir,
      entry: draft.entry,
      tp: draft.tp,
      sl: draft.sl,
      conf: draft.conf,
      source: draft.source,
      reason: draft.reason,
      openCopyTrade,
    });

    gtmEvent('terminal_chart_community_signal', {
      source: options?.sourceContext || 'chart-action',
      pair: draft.pair,
      dir: draft.dir,
      entry: draft.entry,
      tp: draft.tp,
      sl: draft.sl,
      conf: draft.conf,
      openCopyTrade,
    });

    pushChartNotice(`${draft.dir} 시그널 생성 완료 · COMMUNITY${openCopyTrade ? ' + COPY' : ''}`);
  }

  function requestChatAssist() {
    gtmEvent('terminal_chat_request_chart', {
      source: 'chart-bar',
      pair: storeState.pair,
      timeframe: storeState.timeframe,
      tradeReady: chatTradeReady,
      tradeDir: chatTradeDir,
    });
    if (chatTradeReady) {
      void activateTradeDrawing(chatTradeDir);
      pushChartNotice(`${chatTradeDir} draw mode active`);
      return;
    }
    emitChatRequest({
      source: 'chart-bar',
      pair: storeState.pair,
      timeframe: storeState.timeframe,
    });
    pushChartNotice('채팅 탭에서 질문 후 거래를 시작하세요');
  }

  export async function activateTradeDrawing(dir?: 'LONG' | 'SHORT') {
    if (!enableTradeLineEntry) return;
    if (chartMode !== 'agent') {
      await setChartMode('agent');
      await tick();
    }
    const mode: DrawingMode = dir === 'SHORT' ? 'shortentry' : dir === 'LONG' ? 'longentry' : 'trade';
    setDrawingMode(mode);
    gtmEvent('terminal_trade_drawing_activate', {
      source: dir ? 'chat-first' : 'unified-tool',
      dir: dir ?? 'auto',
      pair: storeState.pair,
      timeframe: storeState.timeframe,
    });
    if (dir) {
      pushChartNotice(`${dir} mode — drag on chart to set ENTRY/TP/SL`);
    } else {
      pushChartNotice('Position mode — drag down LONG · drag up SHORT');
    }
  }

  onDestroy(() => {
    if (_patternRangeScanTimer) clearTimeout(_patternRangeScanTimer);
    if (_priceUpdateTimer) clearTimeout(_priceUpdateTimer);
    if (_tvInitTimer) clearTimeout(_tvInitTimer);
    if (_tvLoadTimer) clearTimeout(_tvLoadTimer);
    if (_chartNoticeTimer) clearTimeout(_chartNoticeTimer);
    if (_drawRAF) cancelAnimationFrame(_drawRAF);
    unbindGlobalDrawingMouseUp();
    unbindRatioDrag();
    if (cleanup) cleanup();
    if (wsCleanup) wsCleanup();
    if (priceWsCleanup) priceWsCleanup();
    destroyTradingView();
  });
</script>

<div class="chart-wrapper" class:tv-like={isTvLikePreset}>
  <div class="chart-bar">
    <div class="bar-top top-meta">
      <div class="pair-summary">
        {#if chartMode === 'trading'}
          <span class="pair-name">{pairBaseLabel}/{pairQuoteLabel}</span>
        {/if}
        <span class="pair-k">LAST</span>
        <span class="pair-last">${formatPrice(livePrice)}</span>
        <span class="pair-move" class:up={priceChange24h >= 0} class:down={priceChange24h < 0}>
          {priceChange24h >= 0 ? '+' : '-'}{Math.abs(priceChange24h).toFixed(2)}%
        </span>
      </div>
      <div class="market-stats">
        <div class="mstat">
          <span class="mstat-k">24H LOW</span>
          <span class="mstat-v">{low24h > 0 ? formatPrice(low24h) : '—'}</span>
        </div>
        <div class="mstat">
          <span class="mstat-k">24H HIGH</span>
          <span class="mstat-v">{high24h > 0 ? formatPrice(high24h) : '—'}</span>
        </div>
        <div class="mstat wide">
          <span class="mstat-k">24H VOL(USDT)</span>
          <span class="mstat-v">{quoteVolume24h > 0 ? formatCompact(quoteVolume24h) : '—'}</span>
        </div>
      </div>
    </div>

    <div class="bar-tools">
      <div class="bar-left">
        <div class="live-indicator">
          <span class="live-dot" class:err={!!error}></span>
          {error ? 'OFFLINE' : 'LIVE'}
        </div>

        {#if chartMode === 'agent'}
          <div class="pair-slot">
            <TokenDropdown value={storeState.pair} compact={isCompactViewport()} onSelect={(detail) => changePair(detail.pair)} />
          </div>
        {/if}

        <div class="tf-compact">
          <span class="tf-compact-label">TF</span>
          <select
            class="tf-compact-select"
            value={normalizeTimeframe(storeState.timeframe)}
            onchange={(e) => changeTF((e.currentTarget as HTMLSelectElement).value)}
            aria-label="Timeframe"
          >
            {#each CORE_TIMEFRAME_OPTIONS as tf}
              <option value={tf.value}>{tf.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="tf-btns">
        {#each CORE_TIMEFRAME_OPTIONS as tf}
          <button
            class="tfbtn"
            class:active={normalizeTimeframe(storeState.timeframe) === tf.value}
            onclick={() => changeTF(tf.value)}
          >
            {tf.label}
          </button>
        {/each}
      </div>

      <div class="bar-controls">
        <div class="mode-toggle">
          <button class="mode-btn" class:active={chartMode === 'agent'} onclick={() => setChartMode('agent')}>
            AGENT
          </button>
          <button class="mode-btn" class:active={chartMode === 'trading'} onclick={() => setChartMode('trading')}>
            TRADING
          </button>
        </div>

        {#if chartMode === 'agent'}
          <div class="draw-tools">
            {#if !isTvLikePreset}
              <button class="draw-btn" class:active={drawingMode === 'hline'} onclick={() => setDrawingMode(drawingMode === 'hline' ? 'none' : 'hline')} title="Horizontal Line">&#x2500;</button>
              <button class="draw-btn" class:active={drawingMode === 'trendline'} onclick={() => setDrawingMode(drawingMode === 'trendline' ? 'none' : 'trendline')} title="Trend Line">&#x2571;</button>
            {/if}
            {#if enableTradeLineEntry}
              <button class="draw-btn trade-tool" class:active={drawingMode === 'trade' || drawingMode === 'longentry' || drawingMode === 'shortentry'} onclick={() => setDrawingMode(drawingMode === 'trade' ? 'none' : 'trade')} title="Position Tool (R) — drag down LONG · drag up SHORT">⬡</button>
            {/if}
            {#if drawings.length > 0 || activeTradeSetup}
              <button class="draw-btn vis-toggle" class:off={!drawingsVisible} onclick={toggleDrawingsVisible} title={drawingsVisible ? 'Hide drawings (V)' : 'Show drawings (V)'}>
                {drawingsVisible ? '◉' : '○'}<span class="vis-count">{drawings.length}</span>
              </button>
            {/if}
            <button class="draw-btn clear-btn" onclick={clearAllDrawings} title="Clear">&#x2715;</button>
          </div>
        {/if}

        {#if chartMode === 'agent'}
          {#if chatFirstMode}
            <button
              class="scan-btn chat-trigger"
              class:ready={chatTradeReady}
              onclick={requestChatAssist}
              title={chatTradeReady ? `AI answer ready. Start ${chatTradeDir} drag on chart.` : 'Open Intel chat and ask AI first'}
            >
              {chatTradeReady ? `START ${chatTradeDir}` : 'OPEN CHAT'}
            </button>
          {:else}
            <button class="scan-btn" onclick={requestAgentScan} title="Run agent scan for current market">
              SCAN
            </button>
          {/if}
          <button
            class="scan-btn pattern-trigger"
            onclick={forcePatternScan}
            title="Re-scan head and shoulders / falling wedge patterns"
          >
            PATTERN
          </button>
          <div class="opinion-actions">
            <button
              class="scan-btn view-btn long"
              onclick={() => publishCommunitySignal('LONG', { openCopyTrade: true, sourceContext: 'chart-view-long' })}
              title="Create LONG community signal and open copy trade modal"
            >
              ▲ LONG VIEW
            </button>
            <button
              class="scan-btn view-btn short"
              onclick={() => publishCommunitySignal('SHORT', { openCopyTrade: true, sourceContext: 'chart-view-short' })}
              title="Create SHORT community signal and open copy trade modal"
            >
              ▼ SHORT VIEW
            </button>
          </div>

          {#if advancedMode && indicatorStripState === 'hidden' && !isTvLikePreset}
            <button class="strip-restore-btn" onclick={() => setIndicatorStripState('expanded')}>IND ON</button>
          {/if}
        {/if}

      </div>
    </div>

    {#if chartMode === 'agent' && klineCache.length > 0 && !advancedMode}
      <div class="bar-meta">
        <div class="ma-vals">
          <span class="ma-tag" style="color:{chartTheme.ma7}">MA(7) {ma7Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
          <span class="ma-tag" style="color:{chartTheme.ma25}">MA(25) {ma25Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
          <span class="ma-tag" style="color:{chartTheme.ma99}">MA(99) {ma99Val.toLocaleString('en-US',{maximumFractionDigits:1})}</span>
          <span class="ma-tag">RSI14 {Number.isFinite(rsiVal) ? rsiVal.toFixed(2) : '—'}</span>
          <span class="ma-tag">VOL {formatCompact(latestVolume)}</span>
        </div>
      </div>
    {/if}
  </div>

  {#if chartMode === 'agent' && advancedMode && indicatorStripState !== 'hidden'}
    <div class="indicator-strip" class:collapsed={indicatorStripState === 'collapsed'}>
      {#if indicatorStripState === 'expanded'}
        <div class="view-mode">
          <button class="view-chip" class:on={chartVisualMode === 'focus'} onclick={() => setChartVisualMode('focus')}>FOCUS</button>
          <button class="view-chip" class:on={chartVisualMode === 'full'} onclick={() => setChartVisualMode('full')}>FULL</button>
        </div>
        <button class="ind-chip" class:on={indicatorEnabled.ma20} onclick={() => toggleIndicator('ma20')} style="--ind-color:{chartTheme.ma20}">
          MA20 <span>{formatPrice(ma20Val)}</span>
        </button>
        <button class="ind-chip" class:on={indicatorEnabled.ma60} onclick={() => toggleIndicator('ma60')} style="--ind-color:{chartTheme.ma60}">
          MA60 <span>{formatPrice(ma60Val)}</span>
        </button>
        <button class="ind-chip optional" class:on={indicatorEnabled.ma120} onclick={() => toggleIndicator('ma120')} style="--ind-color:{chartTheme.ma120}">
          MA120 <span>{formatPrice(ma120Val)}</span>
        </button>
        {#if chartVisualMode === 'full'}
          <button class="ind-chip muted" class:on={indicatorEnabled.ma7} onclick={() => toggleIndicator('ma7')} style="--ind-color:{chartTheme.ma7}">
            MA7
          </button>
          <button class="ind-chip muted" class:on={indicatorEnabled.ma25} onclick={() => toggleIndicator('ma25')} style="--ind-color:{chartTheme.ma25}">
            MA25
          </button>
          <button class="ind-chip muted" class:on={indicatorEnabled.ma99} onclick={() => toggleIndicator('ma99')} style="--ind-color:{chartTheme.ma99}">
            MA99
          </button>
        {/if}
        <button class="ind-chip" class:on={indicatorEnabled.rsi} onclick={() => toggleIndicator('rsi')} style="--ind-color:{chartTheme.rsi}">
          RSI14 <span>{Number.isFinite(rsiVal) && rsiVal > 0 ? rsiVal.toFixed(2) : '—'}</span>
        </button>
        <button class="ind-chip" class:on={indicatorEnabled.vol} onclick={() => toggleIndicator('vol')} style="--ind-color:{chartTheme.candleUp}">
          VOL <span>{formatCompact(latestVolume)}</span>
        </button>
        <button class="legend-chip" class:on={showIndicatorLegend} onclick={toggleIndicatorLegend}>LABELS</button>
        <button class="legend-chip" onclick={() => setIndicatorStripState('collapsed')}>접기</button>
        <button class="legend-chip danger" onclick={() => setIndicatorStripState('hidden')}>끄기</button>
        {#if enableTradeLineEntry}
          <span class="ind-hint">L/S drag · +/- zoom · 0 reset</span>
        {/if}
      {:else}
        <div class="collapsed-summary">
          <span class="sum-title">INDICATORS</span>
          <span class="sum-item">MA20 {formatPrice(ma20Val)}</span>
          <span class="sum-item">MA60 {formatPrice(ma60Val)}</span>
          <span class="sum-item optional">MA120 {formatPrice(ma120Val)}</span>
          <span class="sum-item">RSI14 {Number.isFinite(rsiVal) && rsiVal > 0 ? rsiVal.toFixed(2) : '—'}</span>
          <span class="sum-item">VOL {formatCompact(latestVolume)}</span>
        </div>
        {#if !isTvLikePreset}
          <div class="strip-actions">
            <button class="legend-chip" class:on={showIndicatorLegend} onclick={toggleIndicatorLegend}>LABELS</button>
            <button class="legend-chip" onclick={() => setIndicatorStripState('expanded')}>펴기</button>
            <button class="legend-chip danger" onclick={() => setIndicatorStripState('hidden')}>끄기</button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="chart-container" bind:this={chartContainer}
    role="application"
    aria-label="Trading chart"
    class:hidden-chart={chartMode !== 'agent'}
    onmousedown={handleChartMouseDown} onmousemove={handleChartMouseMove}
    onmouseup={handleChartMouseUp} onmouseleave={handleChartMouseUp} onwheel={handleChartWheel}>
    {#if isLoading && chartMode === 'agent'}
      <div class="loading-overlay"><div class="loader"></div><span>Loading {symbol}...</span></div>
    {/if}
    {#if error && chartMode === 'agent'}
      <div class="error-badge">{error}</div>
    {/if}
    {#if chartMode === 'agent'}
      <div class="scale-tools">
        <button class="scale-btn" onclick={() => zoomChart(-1)} title="Zoom Out">-</button>
        <button class="scale-btn" onclick={() => zoomChart(1)} title="Zoom In">+</button>
        <button class="scale-btn wide" onclick={fitChartRange} title="Fit Time Range">FIT</button>
        <button class="scale-btn wide" class:on={autoScaleY} onclick={toggleAutoScaleY} title="Y Auto Scale">Y-AUTO</button>
        <button class="scale-btn wide" onclick={resetChartScale} title="Reset Scale">RESET</button>
      </div>
    {/if}
    {#if chartMode === 'agent' && advancedMode && showIndicatorLegend}
      <div class="indicator-legend">
        {#if indicatorEnabled.ma20}
          <span class="legend-item" style="--legend-color:{chartTheme.ma20}">MA20 {ma20Val > 0 ? formatPrice(ma20Val) : '—'}</span>
        {/if}
        {#if indicatorEnabled.ma60}
          <span class="legend-item" style="--legend-color:{chartTheme.ma60}">MA60 {ma60Val > 0 ? formatPrice(ma60Val) : '—'}</span>
        {/if}
        {#if indicatorEnabled.ma120}
          <span class="legend-item" style="--legend-color:{chartTheme.ma120}">MA120 {ma120Val > 0 ? formatPrice(ma120Val) : '—'}</span>
        {/if}
        {#if indicatorEnabled.ma7}
          <span class="legend-item" style="--legend-color:{chartTheme.ma7}">MA7 {ma7Val > 0 ? formatPrice(ma7Val) : '—'}</span>
        {/if}
        {#if indicatorEnabled.ma25}
          <span class="legend-item" style="--legend-color:{chartTheme.ma25}">MA25 {ma25Val > 0 ? formatPrice(ma25Val) : '—'}</span>
        {/if}
        {#if indicatorEnabled.ma99}
          <span class="legend-item" style="--legend-color:{chartTheme.ma99}">MA99 {ma99Val > 0 ? formatPrice(ma99Val) : '—'}</span>
        {/if}
        {#if indicatorEnabled.rsi}
          <span class="legend-item" style="--legend-color:{chartTheme.rsi}">RSI14(상대강도지수) {rsiVal > 0 ? rsiVal.toFixed(2) : '—'}</span>
        {/if}
        {#if indicatorEnabled.vol}
          <span class="legend-item" style="--legend-color:{chartTheme.candleUp}">VOL(거래량) {latestVolume > 0 ? formatCompact(latestVolume) : '—'}</span>
        {/if}
      </div>
    {/if}

    {#if chartMode === 'agent'}
      <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
      <canvas class="drawing-canvas" bind:this={drawingCanvas}
        role="application"
        aria-label="Chart drawing overlay"
        class:drawing-active={drawingMode !== 'none'}
        onmousedown={handleDrawingMouseDown} onmousemove={handleDrawingMouseMove} onmouseup={handleDrawingMouseUp}></canvas>
    {/if}

    <!-- ═══ Overlay close button (HTML, always clickable above canvas) ═══ -->
    {#if activeTradeSetup && drawingsVisible && chartMode === 'agent'}
      <button class="overlay-close-btn"
        onclick={(e: MouseEvent) => { e.stopPropagation(); activeTradeSetup = null; _agentCloseBtn = null; emitClearTradeSetup(); renderDrawings(); }}
        title="Close overlay">&#x2715;</button>
    {/if}

    <!-- ═══ First-scan CTA (shows before any scan) ═══ -->
    {#if !hasScanned && !activeTradeSetup && chartMode === 'agent'}
      <div class="first-scan-cta">
        <button class="fsc-btn" onclick={requestAgentScan}>
          <span class="fsc-icon">&#x25C9;</span>
          <span class="fsc-label">RUN FIRST SCAN</span>
          <span class="fsc-sub">Generate agent consensus</span>
        </button>
      </div>
    {/if}

    <!-- ═══ Post-scan Trade CTA (shows after scan with active setup) ═══ -->
    {#if activeTradeSetup && chartMode === 'agent'}
      <div class="trade-cta-bar">
        <span class="tcb-dir" class:long={activeTradeSetup.dir === 'LONG'} class:short={activeTradeSetup.dir === 'SHORT'}>
          {activeTradeSetup.dir === 'LONG' ? '▲' : '▼'} {activeTradeSetup.dir}
        </span>
        <span class="tcb-conf">{activeTradeSetup.conf}%</span>
        <span class="tcb-rr">R:R 1:{activeTradeSetup.rr.toFixed(1)}</span>
        <button class="tcb-execute" class:long={activeTradeSetup.dir === 'LONG'} class:short={activeTradeSetup.dir === 'SHORT'}
          onclick={() => {
            if (activeTradeSetup) openQuickTrade(activeTradeSetup.pair, activeTradeSetup.dir as TradeDirection, activeTradeSetup.entry, activeTradeSetup.tp, activeTradeSetup.sl);
          }}>
          EXECUTE {activeTradeSetup.dir}
        </button>
        <button
          class="tcb-copy"
          onclick={() => {
            if (activeTradeSetup) publishCommunitySignal(activeTradeSetup.dir, { openCopyTrade: true, sourceContext: 'trade-cta' });
          }}
          title="Publish current setup to community and open copy trade"
        >
          SIGNAL + COPY
        </button>
      </div>
    {/if}

    {#if drawingMode !== 'none' && chartMode === 'agent'}
      <div class="drawing-indicator">
        {#if drawingMode === 'hline'}
          ── CLICK to place horizontal line
        {:else if drawingMode === 'trendline'}
          CLICK two points for trend line
        {:else if drawingMode === 'trade'}
          Position — drag down LONG · drag up SHORT
        {:else if drawingMode === 'longentry'}
          LONG — drag to set ENTRY / SL / TP
        {:else if drawingMode === 'shortentry'}
          SHORT — drag to set ENTRY / SL / TP
        {/if}
        <button class="drawing-cancel" onclick={() => setDrawingMode('none')}>ESC</button>
      </div>
    {/if}

    {#if chartNotice}
      <div class="chart-notice">{chartNotice}</div>
    {/if}

    {#if showPosition && posEntry !== null && posTp !== null && posSl !== null}
      <div class="pos-overlay">
        <div class="pos-badge {posDir.toLowerCase()}">
          {posDir === 'LONG' ? '▲ LONG' : posDir === 'SHORT' ? '▼ SHORT' : '— NEUTRAL'}
        </div>
        <div class="pos-levels">
          <span class="pos-tp" class:highlight={hoverLine === 'tp' || isDragging === 'tp'}>{hoverLine === 'tp' ? '↕' : ''} TP ${Math.round(posTp).toLocaleString()}</span>
          <span class="pos-entry" class:highlight={hoverLine === 'entry' || isDragging === 'entry'}>{hoverLine === 'entry' ? '↕' : ''} ENTRY ${Math.round(posEntry).toLocaleString()}</span>
          <span class="pos-sl" class:highlight={hoverLine === 'sl' || isDragging === 'sl'}>{hoverLine === 'sl' ? '↕' : ''} SL ${Math.round(posSl).toLocaleString()}</span>
        </div>
        <div class="pos-rr">R:R 1:{(Math.abs(posTp - posEntry) / Math.max(1, Math.abs(posEntry - posSl))).toFixed(1)}</div>
        <div class="pos-hint">DRAG or SCROLL lines to adjust</div>
      </div>
    {/if}

    {#if pendingTradePlan}
      {@const planned = getPlannedTradeOrder(pendingTradePlan)}
      <div class="trade-plan-overlay">
        <div class="trade-plan-header">
          <span class="plan-title">TRADE PLANNER</span>
          <button type="button" class="plan-close" onclick={cancelTradePlan}>✕</button>
        </div>
        <div class="trade-plan-grid">
          <div class="plan-row"><span>SIGNAL</span><strong>{pendingTradePlan.previewDir}</strong></div>
          <div class="plan-row"><span>ENTRY</span><strong>{formatPrice(planned.entry)}</strong></div>
          <div class="plan-row"><span>TP</span><strong class="tp">{formatPrice(planned.tp)}</strong></div>
          <div class="plan-row"><span>SL</span><strong class="sl">{formatPrice(planned.sl)}</strong></div>
          <div class="plan-row"><span>RISK</span><strong>{planned.riskPct.toFixed(2)}%</strong></div>
          <div class="plan-row"><span>R:R</span><strong>1:{planned.rr.toFixed(1)}</strong></div>
        </div>
        <div class="plan-ratio-meta">
          <span class:active={planned.dir === 'LONG'}>LONG {planned.longRatio}%</span>
          <span class:active={planned.dir === 'SHORT'}>SHORT {planned.shortRatio}%</span>
        </div>
        <button
          type="button"
          class="plan-ratio-track"
          bind:this={ratioTrackEl}
          onpointerdown={handleRatioPointerDown}
          aria-label="Adjust long short ratio"
        >
          <div class="plan-ratio-long" style="width:{planned.longRatio}%"></div>
          <div class="plan-ratio-knob" style="left:calc({planned.longRatio}% - 8px)"></div>
        </button>
        <div class="plan-ratio-presets">
          <button type="button" onclick={() => setTradePlanRatio(80)}>80/20</button>
          <button type="button" onclick={() => setTradePlanRatio(65)}>65/35</button>
          <button type="button" onclick={() => setTradePlanRatio(50)}>50/50</button>
          <button type="button" onclick={() => setTradePlanRatio(35)}>35/65</button>
          <button type="button" onclick={() => setTradePlanRatio(20)}>20/80</button>
        </div>
        <div class="plan-actions">
          <button type="button" class="plan-action ghost" onclick={cancelTradePlan}>CANCEL</button>
          <button type="button" class="plan-action primary" class:long={planned.dir === 'LONG'} class:short={planned.dir === 'SHORT'} onclick={openTradeFromPlan}>
            OPEN {planned.dir}
          </button>
        </div>
      </div>
    {/if}

    {#if chartMode === 'agent'}
      {#each agentAnnotations as ann (ann.id)}
        <button class="chart-annotation" style="top:{ann.yPercent}%;left:{ann.xPercent}%;--ann-color:{ann.color}"
          class:active={selectedAnnotation?.id === ann.id}
          onclick={(e: MouseEvent) => { e.stopPropagation(); selectedAnnotation = selectedAnnotation?.id === ann.id ? null : ann; }}>
          <span class="ann-icon">{ann.icon}</span>
          {#if selectedAnnotation?.id === ann.id}
            <div class="ann-popup">
              <div class="ann-popup-header" style="border-color:{ann.color}">
                <span class="ann-popup-icon">{ann.icon}</span>
                <span class="ann-popup-name" style="color:{ann.color}">{ann.name}</span>
                <span class="ann-popup-type">{ann.type.toUpperCase()}</span>
              </div>
              <div class="ann-popup-label">{ann.label}</div>
              <div class="ann-popup-detail">{ann.detail}</div>
            </div>
          {/if}
        </button>
      {/each}
    {/if}

    {#if isDragging && chartMode === 'agent'}
      <div class="drag-indicator">DRAGGING {isDragging.toUpperCase()} — Release to set</div>
    {/if}
  </div>

  {#if chartMode === 'trading'}
    <div class="tv-container" bind:this={tvContainer}>
      <div id="tradingview_widget" style="width:100%;height:100%"></div>
      {#if tvLoading}
        <div class="loading-overlay tv-skeleton">
          <div class="tv-skeleton-bars"></div>
          <div class="tv-skeleton-content">
            <div class="loader"></div>
            <span>Loading TradingView...</span>
            {#if _tvFallbackTried}
              <button class="tv-fallback-btn" onclick={() => setChartMode('agent')}>Agent 차트로 전환</button>
            {/if}
          </div>
        </div>
      {/if}
      {#if tvError}
        <div class="tv-error-card">
          <div class="tv-error-title">TradingView 연결 오류</div>
          <div class="tv-error-desc">{tvError}</div>
          <div class="tv-error-actions">
            <button class="tv-retry-btn" onclick={retryTradingView}>다시 시도</button>
            <a
              class="tv-open-link"
              href={`https://www.tradingview.com/chart/?symbol=${pairToTradingViewSymbol(storeState.pair)}`}
              target="_blank"
              rel="noreferrer"
            >
              TradingView에서 열기
            </a>
          </div>
          {#if tvSafeMode}
            <div class="tv-safe-hint">Safe mode로 재시도 중</div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- chart-footer removed: pattern info shown on chart overlay, indicators in legend -->
</div>

<style>
  .chart-wrapper {
    --cp-font-2xs: clamp(8px, 0.56vw, 9px);
    --cp-font-xs: clamp(9px, 0.64vw, 10px);
    --cp-font-sm: clamp(10px, 0.74vw, 11px);
    --cp-font-md: clamp(11px, 0.86vw, 13px);
    --cp-font-lg: clamp(15px, 1.15vw, 18px);
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0a1a;
    overflow: hidden;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }
  .chart-bar {
    padding: 3px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 3px;
    background: linear-gradient(90deg, #1a1a3a, #0a0a2a);
    font-size: 10px;
    font-family: var(--fm);
    flex-shrink: 0;
  }
  .bar-top.top-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }
  .bar-top.top-meta::-webkit-scrollbar {
    height: 2px;
  }
  .bar-top.top-meta::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }
  .pair-summary {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    min-width: max-content;
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .pair-name {
    color: rgba(232, 237, 247, 0.92);
    font-family: var(--fd);
    font-size: var(--cp-font-md);
    font-weight: 800;
    letter-spacing: .18px;
  }
  .pair-k {
    color: rgba(187, 198, 216, 0.66);
    font-family: var(--fm);
    font-size: var(--cp-font-2xs);
    font-weight: 700;
    letter-spacing: .42px;
  }
  .pair-last {
    color: #f5f8ff;
    font-family: var(--fd);
    font-size: var(--cp-font-lg);
    font-weight: 900;
    letter-spacing: .18px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pair-move {
    font-family: var(--fd);
    font-size: var(--cp-font-sm);
    font-weight: 800;
    letter-spacing: .12px;
    font-variant-numeric: tabular-nums;
  }
  .pair-move.up { color: #00ff88; }
  .pair-move.down { color: #ff2d55; }
  .pair-move:not(.up):not(.down) { color: rgba(190, 198, 214, 0.9); }
  .bar-left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: max-content;
    flex: 0 0 auto;
  }
  .pair-slot {
    min-width: 128px;
    flex: 0 1 auto;
  }
  .market-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }
  .market-stats::-webkit-scrollbar { height: 2px; }
  .market-stats::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }
  .mstat {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    height: auto;
    padding: 0;
    border: 0;
    background: transparent;
    white-space: nowrap;
  }
  .mstat.wide {
    min-width: auto;
  }
  .mstat-k {
    font-family: var(--fm);
    font-size: var(--cp-font-2xs);
    font-weight: 700;
    letter-spacing: .4px;
    color: rgba(187, 198, 216, 0.66);
  }
  .mstat-v {
    font-family: var(--fd);
    font-size: var(--cp-font-md);
    font-weight: 800;
    letter-spacing: .12px;
    color: rgba(255,255,255,.92);
    font-variant-numeric: tabular-nums;
  }
  .bar-tools {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-top: 1px;
    padding-bottom: 1px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .bar-tools::-webkit-scrollbar { height: 2px; }
  .bar-tools::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }
  .bar-controls {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: max-content;
    flex: 0 0 auto;
  }
  .bar-meta {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }
  .bar-meta::-webkit-scrollbar { height: 2px; }
  .bar-meta::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
  }
  .live-indicator { font-size: var(--cp-font-xs); font-weight: 800; color: var(--grn); display: flex; align-items: center; gap: 4px; letter-spacing: .45px; }
  .live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--grn); animation: pulse .8s infinite; }
  .live-dot.err { background: #ff2d55; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .tf-btns {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 1px;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }
  .tf-btns::-webkit-scrollbar { height: 2px; }
  .tf-btns::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 999px;
  }
  .tf-compact {
    display: none;
    align-items: center;
    gap: 3px;
    margin-left: 1px;
    min-width: max-content;
    flex: 0 0 auto;
  }
  .tf-compact-label {
    color: rgba(187, 198, 216, 0.66);
    font-family: var(--fm);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: .5px;
  }
  .tf-compact-select {
    height: 24px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.06);
    color: rgba(232, 237, 247, 0.92);
    font-family: var(--fd);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .35px;
    padding: 0 24px 0 8px;
    appearance: none;
    cursor: pointer;
  }
  .tf-compact-select:focus-visible {
    outline: 1px solid rgba(232,150,125,.45);
    outline-offset: 1px;
  }
  .tfbtn { padding: 2px 7px; border-radius: 4px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); color: #b8c0cc; font-size: var(--cp-font-2xs); font-family: var(--fd); font-weight: 700; letter-spacing: .3px; cursor: pointer; transition: all .15s; }
  .tfbtn:hover { background: rgba(255,255,255,.1); color: #fff; }
  .tfbtn.active { background: rgba(232,150,125,.15); color: #E8967D; border-color: rgba(232,150,125,.3); }

  .ma-vals { display: flex; gap: 8px; flex-wrap: nowrap; white-space: nowrap; }
  .ma-tag { font-size: var(--cp-font-2xs); font-family: var(--fm); font-weight: 700; letter-spacing: .2px; opacity: 1; }

  @media (max-width: 1280px) {
    .pair-last { font-size: clamp(14px, 1.05vw, 16px); }
    .mstat-v { font-size: clamp(10px, 0.72vw, 11px); }
  }

  @media (max-width: 1280px) {
    .tf-btns {
      display: none;
    }
    .tf-compact {
      display: inline-flex;
    }
  }

  @media (max-width: 768px) {
    .chart-bar {
      padding: 4px 6px;
      gap: 3px;
    }
    .bar-top.top-meta {
      gap: 6px;
    }
    .pair-summary {
      gap: 6px;
    }
    .pair-k {
      font-size: 8px;
      letter-spacing: .42px;
    }
    .pair-name {
      font-size: 12px;
      letter-spacing: .25px;
    }
    .pair-last {
      font-size: 14px;
    }
    .pair-move {
      font-size: 10px;
    }
    .market-stats {
      gap: 6px;
    }
    .mstat-k {
      font-size: 8px;
      letter-spacing: .45px;
    }
    .mstat-v {
      font-size: 11px;
    }
    .bar-left {
      gap: 4px;
    }
    .live-indicator {
      font-size: 10px;
      letter-spacing: .6px;
    }
    .pair-slot {
      min-width: 138px;
      flex: 0 0 auto;
    }
    .bar-tools {
      gap: 4px;
    }
    .tf-btns {
      width: auto;
      flex: 0 0 auto;
    }
    .tf-compact {
      margin-left: 0;
    }
    .tf-compact-select {
      height: 24px;
      font-size: 10px;
      padding: 0 20px 0 7px;
    }
    .tfbtn {
      height: 22px;
      padding: 0 7px;
      font-size: 9px;
      letter-spacing: .32px;
      white-space: nowrap;
    }
    .bar-controls {
      gap: 2px;
    }
    .mode-toggle .mode-btn {
      min-height: 22px;
      padding: 0 7px;
      font-size: 9px;
      letter-spacing: .3px;
    }
    .draw-tools .draw-btn {
      width: 22px;
      height: 22px;
      font-size: 9px;
    }
    .scan-btn {
      min-height: 22px;
      height: 22px;
      padding: 0 7px;
      font-size: 9px;
      letter-spacing: .28px;
    }
    .ma-vals {
      gap: 6px;
    }
  }

  .chart-container { flex: 1; position: relative; overflow: hidden; }
  .chart-container.hidden-chart { display: none; }
  .indicator-legend {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 7;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2px;
    padding: 5px 6px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(5,8,16,.82);
    backdrop-filter: blur(4px);
    pointer-events: none;
    max-width: min(460px, 54%);
  }
  .scale-tools {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    z-index: 8;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(7, 12, 20, 0.86);
    backdrop-filter: blur(4px);
    box-shadow: 0 8px 24px rgba(0,0,0,.34);
  }
  .scale-btn {
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.06);
    color: rgba(255,255,255,.8);
    border-radius: 6px;
    min-width: 26px;
    height: 22px;
    padding: 0 6px;
    font-family: var(--fd);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }
  .scale-btn.wide { min-width: 46px; }
  .scale-btn:hover {
    color: #fff;
    border-color: rgba(255,255,255,.35);
    background: rgba(255,255,255,.12);
  }
  .scale-btn.on {
    color: #F5C4B8;
    border-color: rgba(232,150,125,.55);
    background: rgba(232,150,125,.16);
  }
  .strip-restore-btn {
    border: 1px solid rgba(255,255,255,.22);
    background: rgba(255,255,255,.08);
    color: rgba(255,255,255,.85);
    border-radius: 6px;
    padding: 3px 8px;
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }
  .strip-restore-btn:hover {
    color: #fff;
    border-color: rgba(232,150,125,.45);
    background: rgba(232,150,125,.16);
  }

  @media (max-width: 1024px) {
    .scale-tools {
      bottom: 6px;
      gap: 3px;
      padding: 3px;
    }
    .scale-btn {
      min-width: 24px;
      height: 20px;
      font-size: 8px;
      padding: 0 5px;
    }
    .scale-btn.wide { min-width: 40px; }
    .strip-restore-btn { padding: 2px 6px; font-size: 8px; }
    .chart-notice { bottom: 36px; }
    .drag-indicator { bottom: 30px; }
    .trade-plan-overlay {
      left: 8px;
      right: 8px;
      width: auto;
      bottom: 42px;
      padding: 8px;
    }
    .plan-ratio-track { height: 22px; }
    .plan-action { padding: 6px 8px; }
  }
  .legend-item {
    --legend-color: #aaa;
    font-family: var(--fm);
    font-size: 8px;
    color: rgba(255,255,255,.88);
    letter-spacing: .35px;
    white-space: nowrap;
  }
  .legend-item::before {
    content: '';
    display: inline-block;
    width: 7px;
    height: 2px;
    border-radius: 2px;
    margin-right: 4px;
    transform: translateY(-1px);
    background: var(--legend-color);
    box-shadow: 0 0 6px var(--legend-color);
  }

  .mode-toggle { display: flex; gap: 0; border-radius: 6px; overflow: hidden; border: 1px solid rgba(232,150,125,.25); margin-left: 0; }
  .mode-btn { padding: 2px 8px; background: rgba(255,255,255,.03); border: none; color: #b2b9c5; font-size: var(--cp-font-2xs); font-family: var(--fd); font-weight: 800; letter-spacing: .4px; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 2px; white-space: nowrap; }
  .mode-btn:first-child { border-right: 1px solid rgba(232,150,125,.15); }
  .mode-btn:hover { background: rgba(232,150,125,.08); color: #ccc; }
  .mode-btn.active { background: linear-gradient(135deg, rgba(232,150,125,.2), rgba(255,180,0,.15)); color: #E8967D; text-shadow: 0 0 8px rgba(232,150,125,.5); }
  .mode-icon { font-size: 10px; line-height: 1; }
  .scan-btn {
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid rgba(232,150,125,.35);
    background: linear-gradient(135deg, rgba(232,150,125,.2), rgba(255,180,0,.12));
    color: #E8967D;
    font-size: var(--cp-font-2xs);
    font-family: var(--fd);
    font-weight: 900;
    letter-spacing: .45px;
    cursor: pointer;
    transition: all .15s;
    white-space: nowrap;
  }
  .scan-btn:hover {
    background: linear-gradient(135deg, rgba(232,150,125,.28), rgba(255,180,0,.18));
    border-color: rgba(232,150,125,.55);
    color: #fff3bf;
    box-shadow: 0 0 10px rgba(232,150,125,.26);
  }
  .scan-btn.chat-trigger {
    border-color: rgba(120, 218, 255, 0.4);
    background: linear-gradient(135deg, rgba(94, 161, 255, 0.34), rgba(94, 161, 255, 0.18));
    color: #d6edff;
  }
  .scan-btn.chat-trigger:hover {
    border-color: rgba(120, 218, 255, 0.62);
    background: linear-gradient(135deg, rgba(94, 161, 255, 0.46), rgba(94, 161, 255, 0.24));
    color: #f0f8ff;
  }
  .scan-btn.chat-trigger.ready {
    border-color: rgba(79, 209, 142, 0.62);
    background: linear-gradient(135deg, rgba(39, 195, 145, 0.38), rgba(39, 195, 145, 0.2));
    color: #dcfff0;
  }
  .scan-btn.chat-trigger.ready:hover {
    border-color: rgba(79, 209, 142, 0.82);
    background: linear-gradient(135deg, rgba(39, 195, 145, 0.5), rgba(39, 195, 145, 0.28));
    color: #f6fff9;
  }
  .scan-btn.pattern-trigger {
    border-color: rgba(255, 140, 160, 0.45);
    background: linear-gradient(135deg, rgba(255, 120, 144, 0.28), rgba(255, 120, 144, 0.12));
    color: #ffdbe2;
  }
  .scan-btn.pattern-trigger:hover {
    border-color: rgba(255, 140, 160, 0.7);
    background: linear-gradient(135deg, rgba(255, 120, 144, 0.4), rgba(255, 120, 144, 0.2));
    color: #fff2f5;
  }
  .opinion-actions { display: flex; align-items: center; gap: 4px; margin-left: 2px; }
  .scan-btn.view-btn.long {
    border-color: rgba(92,212,160,.52);
    background: linear-gradient(135deg, rgba(92,212,160,.3), rgba(92,212,160,.14));
    color: #d9ffe9;
  }
  .scan-btn.view-btn.long:hover {
    border-color: rgba(92,212,160,.78);
    background: linear-gradient(135deg, rgba(92,212,160,.42), rgba(92,212,160,.2));
    color: #f4fff9;
  }
  .scan-btn.view-btn.short {
    border-color: rgba(231,127,144,.55);
    background: linear-gradient(135deg, rgba(231,127,144,.3), rgba(231,127,144,.14));
    color: #ffe4ea;
  }
  .scan-btn.view-btn.short:hover {
    border-color: rgba(231,127,144,.78);
    background: linear-gradient(135deg, rgba(231,127,144,.42), rgba(231,127,144,.2));
    color: #fff5f7;
  }

  .draw-tools { display: flex; gap: 2px; margin-left: 0; padding-left: 0; border-left: none; }
  .draw-btn { width: 22px; height: 19px; border-radius: 4px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); color: #b5bdc9; font-size: var(--cp-font-sm); font-family: monospace; cursor: pointer; transition: all .15s; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
  .draw-btn:hover { background: rgba(232,150,125,.1); color: #E8967D; border-color: rgba(232,150,125,.3); }
  .draw-btn.active { background: rgba(232,150,125,.2); color: #E8967D; border-color: #E8967D; box-shadow: 0 0 6px rgba(232,150,125,.3); }
  .draw-btn.long-tool { font-family: var(--fd); font-size: 8px; color: #5cd4a0; border-color: rgba(92,212,160,.22); }
  .draw-btn.long-tool:hover { background: rgba(92,212,160,.15); color: #78e9bc; border-color: rgba(92,212,160,.45); }
  .draw-btn.long-tool.active { background: rgba(92,212,160,.2); color: #88ffd0; border-color: rgba(92,212,160,.6); box-shadow: 0 0 8px rgba(92,212,160,.35); }
  .draw-btn.short-tool { font-family: var(--fd); font-size: 8px; color: #e77f90; border-color: rgba(231,127,144,.22); }
  .draw-btn.short-tool:hover { background: rgba(231,127,144,.15); color: #ff9caf; border-color: rgba(231,127,144,.45); }
  .draw-btn.short-tool.active { background: rgba(231,127,144,.2); color: #ffadbc; border-color: rgba(231,127,144,.6); box-shadow: 0 0 8px rgba(231,127,144,.35); }
  .draw-btn.trade-tool { font-size: 10px; color: #E8967D; border-color: rgba(232,150,125,.25); width: 26px; }
  .draw-btn.trade-tool:hover { background: rgba(232,150,125,.15); color: #f0a88e; border-color: rgba(232,150,125,.45); }
  .draw-btn.trade-tool.active { background: rgba(232,150,125,.2); color: #f5c0a8; border-color: rgba(232,150,125,.6); box-shadow: 0 0 8px rgba(232,150,125,.35); }
  .draw-btn.vis-toggle { font-size: 9px; gap: 2px; width: auto; padding: 0 5px; color: #E8967D; border-color: rgba(232,150,125,.2); }
  .draw-btn.vis-toggle:hover { background: rgba(232,150,125,.1); border-color: rgba(232,150,125,.35); }
  .draw-btn.vis-toggle.off { opacity: 0.35; border-style: dashed; }
  .draw-btn.vis-toggle.off:hover { opacity: 0.7; }
  .vis-count { font-family: var(--fd, monospace); font-size: 8px; color: rgba(232,150,125,.6); }
  .draw-btn.clear-btn:hover { background: rgba(255,45,85,.15); color: #ff2d55; border-color: rgba(255,45,85,.4); }

  .indicator-strip {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid rgba(255,255,255,.06);
    background: rgba(255,255,255,.03);
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .indicator-strip.collapsed {
    justify-content: flex-start;
    gap: 6px;
  }
  .collapsed-summary {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    flex: 1 1 auto;
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    padding-bottom: 1px;
  }
  .sum-title {
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: .8px;
    color: rgba(255,255,255,.92);
  }
  .sum-item {
    font-family: var(--fm);
    font-size: 7px;
    color: rgba(255,255,255,.74);
    letter-spacing: .25px;
    white-space: nowrap;
  }
  .strip-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 0;
    flex: 0 0 auto;
  }
  .view-mode {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-right: 2px;
    padding-right: 6px;
    border-right: 1px solid rgba(255,255,255,.12);
  }
  .view-chip {
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.78);
    border-radius: 10px;
    padding: 2px 8px;
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }
  .view-chip.on {
    color: #fff;
    border-color: rgba(232,150,125,.6);
    background: rgba(232,150,125,.16);
    box-shadow: 0 0 8px rgba(232,150,125,.22);
  }
  .view-chip:hover {
    border-color: rgba(255,255,255,.32);
    color: #fff;
  }
  .ind-chip {
    --ind-color: #888;
    border: 1px solid rgba(255,255,255,.15);
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.74);
    border-radius: 12px;
    padding: 2px 7px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .3px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all .15s;
  }
  .ind-chip span { color: var(--ind-color); font-weight: 900; }
  .ind-chip.on {
    color: rgba(255,255,255,.95);
    border-color: var(--ind-color);
    background: rgba(255,255,255,.12);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.1);
  }
  .ind-chip.muted { opacity: .72; }
  .ind-chip.optional { opacity: .88; }
  .ind-chip:hover {
    color: #fff;
    border-color: rgba(255,255,255,.24);
  }
  .ind-hint {
    margin-left: auto;
    font-family: var(--fm);
    font-size: 8px;
    color: rgba(255,255,255,.58);
    letter-spacing: .4px;
  }
  .legend-chip {
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.78);
    border-radius: 10px;
    padding: 2px 7px;
    font-family: var(--fd);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .5px;
    cursor: pointer;
    transition: all .15s;
  }
  .legend-chip.on {
    color: #F5C4B8;
    border-color: rgba(232,150,125,.45);
    background: rgba(232,150,125,.14);
  }
  .legend-chip.danger {
    color: rgba(255,165,165,.85);
    border-color: rgba(255,120,120,.32);
  }
  .legend-chip.danger:hover {
    color: #ffd0d0;
    border-color: rgba(255,120,120,.55);
    background: rgba(255,70,70,.14);
  }
  .legend-chip:hover { color: #fff; border-color: rgba(255,255,255,.36); }

  .drawing-canvas { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
  .drawing-canvas.drawing-active { pointer-events: auto; cursor: crosshair; }

  .drawing-indicator { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); z-index: 15; padding: 4px 12px; border-radius: 6px; background: rgba(232,150,125,.12); border: 1px solid rgba(232,150,125,.3); color: #E8967D; font-size: 9px; font-weight: 700; font-family: var(--fm); letter-spacing: .9px; display: flex; align-items: center; gap: 8px; animation: drawPulse 1.5s ease infinite; }
  @keyframes drawPulse { 0%,100% { opacity: 1 } 50% { opacity: .65 } }
  .drawing-cancel { padding: 1px 6px; border-radius: 3px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15); color: #ddd; font-size: 7px; font-family: var(--fm); font-weight: 800; cursor: pointer; letter-spacing: .8px; }
  .drawing-cancel:hover { background: rgba(255,45,85,.2); color: #ff2d55; border-color: rgba(255,45,85,.4); }
  .chart-notice {
    position: absolute;
    left: 50%;
    bottom: 44px;
    transform: translateX(-50%);
    z-index: 18;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(232,150,125,.3);
    background: rgba(0,0,0,.7);
    color: #ffe7b8;
    font-family: var(--fm);
    font-size: 9px;
    letter-spacing: .4px;
    box-shadow: 0 8px 24px rgba(0,0,0,.4);
    pointer-events: none;
    white-space: nowrap;
  }

  /* ═══ Overlay close button (HTML) ═══ */
  .overlay-close-btn {
    position: absolute; top: 8px; right: 80px; z-index: 10;
    width: 22px; height: 22px; border-radius: 4px;
    background: rgba(10,9,8,.8); border: 1px solid rgba(232,150,125,.35);
    color: rgba(232,150,125,.9); font-size: 11px; line-height: 1;
    cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center;
  }
  .overlay-close-btn:hover { background: rgba(232,150,125,.15); border-color: #E8967D; color: #E8967D; }

  /* ═══ First-scan CTA overlay ═══ */
  .first-scan-cta {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 12;
  }
  .fsc-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(10,9,8,.76);
    border: 1.5px solid rgba(232,150,125,.3);
    cursor: pointer; transition: all .2s;
    backdrop-filter: blur(4px);
  }
  .fsc-btn:hover { border-color: #E8967D; box-shadow: 0 0 12px rgba(232,150,125,.15); background: rgba(232,150,125,.14); }
  .fsc-icon { font-size: 11px; color: #E8967D; animation: fscPulse 2s ease infinite; }
  @keyframes fscPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.92)} }
  .fsc-label { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px; color: #E8967D; }
  .fsc-sub { font-family: var(--fm); font-size: 8px; color: rgba(240,237,228,.62); letter-spacing: .3px; }
  @media (max-width: 768px) {
    .first-scan-cta { top: 6px; right: 6px; }
    .fsc-sub { display: none; }
    .fsc-btn { padding: 4px 8px; }
  }

  /* ═══ Post-scan Trade CTA bar ═══ */
  .trade-cta-bar {
    position: absolute; bottom: 0; left: 0; right: 0; z-index: 14;
    display: flex; align-items: center; gap: 10px;
    padding: 6px 12px;
    background: rgba(10,9,8,.9); border-top: 1px solid rgba(232,150,125,.2);
    backdrop-filter: blur(4px);
  }
  .tcb-dir { font-family: var(--fm); font-size: 11px; font-weight: 900; letter-spacing: 1px; }
  .tcb-dir.long { color: var(--grn, #00ff88); }
  .tcb-dir.short { color: var(--red, #ff2d55); }
  .tcb-conf { font-family: var(--fd); font-size: 12px; font-weight: 800; color: rgba(240,237,228,.6); }
  .tcb-rr { font-family: var(--fm); font-size: 9px; color: rgba(240,237,228,.4); letter-spacing: .5px; }
  .tcb-execute {
    margin-left: auto;
    padding: 5px 16px; border-radius: 4px;
    font-family: var(--fm); font-size: 10px; font-weight: 900; letter-spacing: 1px;
    cursor: pointer; transition: all .15s; border: 1px solid;
  }
  .tcb-execute.long { color: #0A0908; background: var(--grn, #00ff88); border-color: var(--grn, #00ff88); }
  .tcb-execute.long:hover { box-shadow: 0 0 12px rgba(0,255,136,.3); }
  .tcb-execute.short { color: #fff; background: var(--red, #ff2d55); border-color: var(--red, #ff2d55); }
  .tcb-execute.short:hover { box-shadow: 0 0 12px rgba(255,45,85,.3); }
  .tcb-copy {
    padding: 5px 10px;
    border-radius: 4px;
    border: 1px solid rgba(232,150,125,.45);
    background: rgba(232,150,125,.16);
    color: #ffe8d8;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: .8px;
    cursor: pointer;
    transition: all .15s;
  }
  .tcb-copy:hover {
    border-color: rgba(232,150,125,.65);
    background: rgba(232,150,125,.24);
    color: #fff5ee;
    box-shadow: 0 0 10px rgba(232,150,125,.24);
  }

  .tv-container { flex: 1; position: relative; overflow: hidden; background: #0a0a1a; }
  .tv-container :global(iframe) { width: 100% !important; height: 100% !important; border: none !important; }
  .tv-error-card {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 12;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 45, 85, 0.35);
    background: rgba(20, 8, 13, 0.9);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
  }
  .tv-error-title {
    font-family: var(--fd);
    font-size: 10px;
    letter-spacing: 1px;
    color: #ff8ca1;
    margin-bottom: 4px;
  }
  .tv-error-desc {
    font-family: var(--fm);
    font-size: 9px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.72);
    margin-bottom: 10px;
  }
  .tv-error-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tv-retry-btn {
    border: 1px solid rgba(232,150,125, 0.35);
    background: rgba(232,150,125, 0.12);
    color: #E8967D;
    border-radius: 6px;
    padding: 6px 10px;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .tv-retry-btn:hover {
    background: rgba(232,150,125, 0.2);
    border-color: rgba(232,150,125, 0.5);
  }
  .tv-open-link {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    color: #9ed9ff;
    text-decoration: none;
    border-bottom: 1px dashed rgba(158, 217, 255, 0.5);
  }
  .tv-open-link:hover {
    color: #c6e9ff;
    border-bottom-color: rgba(198, 233, 255, 0.8);
  }
  .tv-safe-hint {
    margin-top: 8px;
    font-family: var(--fm);
    font-size: 8px;
    color: rgba(255, 255, 255, 0.62);
    letter-spacing: 0.8px;
  }

  .loading-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: rgba(10,10,26,.9); z-index: 10; color: #d0d6df; font-size: 10px; font-family: var(--fm); }
  .tv-skeleton { overflow: hidden; }
  .tv-skeleton-bars {
    position: absolute; inset: 0;
    background: repeating-linear-gradient(90deg, rgba(232,150,125,.04) 0px, rgba(232,150,125,.08) 12px, rgba(232,150,125,.04) 24px);
    animation: skeletonShimmer 1.5s ease-in-out infinite;
  }
  .tv-skeleton-content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  @keyframes skeletonShimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
  .tv-fallback-btn {
    margin-top: 6px; padding: 5px 14px; font: 700 9px var(--fm); letter-spacing: .5px;
    background: rgba(232,150,125,.15); border: 1px solid rgba(232,150,125,.35);
    border-radius: 4px; color: #E8967D; cursor: pointer; transition: all .15s;
  }
  .tv-fallback-btn:hover { background: rgba(232,150,125,.25); }
  .loader { width: 24px; height: 24px; border: 2px solid rgba(232,150,125,.2); border-top-color: #E8967D; border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-badge { position: absolute; top: 6px; left: 6px; padding: 3px 8px; border-radius: 4px; background: rgba(255,45,85,.2); border: 1px solid rgba(255,45,85,.4); color: #ff2d55; font-size: 8px; font-family: var(--fm); font-weight: 700; z-index: 5; }

  .pos-overlay { position: absolute; top: 6px; right: 6px; z-index: 12; display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
  .pos-badge { padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; font-family: var(--fd); letter-spacing: 2px; border: 2px solid; }
  .pos-badge.long { background: rgba(0,255,136,.2); border-color: #00ff88; color: #00ff88; }
  .pos-badge.short { background: rgba(255,45,85,.2); border-color: #ff2d55; color: #ff2d55; }
  .pos-badge.neutral { background: rgba(255,170,0,.2); border-color: #ffaa00; color: #ffaa00; }
  .pos-levels { display: flex; flex-direction: column; gap: 1px; font-size: 8px; font-family: var(--fm); font-weight: 700; text-align: right; }
  .pos-tp { color: #4ade80; }
  .pos-entry { color: #ffba30; }
  .pos-sl { color: #ff4060; }
  .pos-rr { font-size: 10px; font-weight: 900; font-family: var(--fd); color: #E8967D; background: rgba(0,0,0,.6); padding: 2px 8px; border-radius: 4px; }
  .pos-hint { font-size: 7px; color: rgba(255,255,255,.5); font-family: var(--fm); letter-spacing: .5px; text-align: right; margin-top: 2px; }
  .pos-levels .highlight { background: rgba(255,255,255,.15); padding: 0 4px; border-radius: 3px; animation: lineHover .5s ease infinite; }
  @keyframes lineHover { 0%,100%{opacity:1} 50%{opacity:.7} }

  .trade-plan-overlay {
    position: absolute;
    right: 10px;
    bottom: 54px;
    z-index: 16;
    width: min(320px, calc(100% - 20px));
    border-radius: 12px;
    border: 1px solid rgba(138, 150, 172, 0.35);
    background: rgba(17, 23, 35, 0.92);
    backdrop-filter: blur(6px);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.4);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .trade-plan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .plan-title {
    font-family: var(--fd);
    font-size: 10px;
    letter-spacing: 1px;
    font-weight: 900;
    color: #d8dfeb;
  }
  .plan-close {
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.75);
    border-radius: 6px;
    width: 22px;
    height: 20px;
    cursor: pointer;
  }
  .plan-close:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.08);
  }
  .trade-plan-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 10px;
  }
  .plan-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(216, 223, 235, 0.82);
  }
  .plan-row strong {
    font-family: var(--fd);
    font-size: 10px;
    letter-spacing: .35px;
    color: #f5f7fb;
  }
  .plan-row strong.tp { color: #27c391; }
  .plan-row strong.sl { color: #e95b6a; }
  .plan-ratio-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--fd);
    font-size: 9px;
    letter-spacing: .6px;
    color: rgba(255, 255, 255, 0.65);
  }
  .plan-ratio-meta span.active {
    color: #f0f3fb;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.22);
  }
  .plan-ratio-track {
    position: relative;
    height: 24px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: linear-gradient(90deg, rgba(39, 195, 145, 0.2), rgba(233, 91, 106, 0.2));
    cursor: ew-resize;
    touch-action: none;
    appearance: none;
    display: block;
    width: 100%;
    padding: 0;
  }
  .plan-ratio-long {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, rgba(39, 195, 145, 0.45), rgba(39, 195, 145, 0.2));
    border-right: 1px solid rgba(0, 0, 0, 0.28);
  }
  .plan-ratio-knob {
    position: absolute;
    top: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.8);
    background: #f4f7ff;
    box-shadow: 0 0 0 2px rgba(17, 23, 35, 0.6);
    pointer-events: none;
  }
  .plan-ratio-presets {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .plan-ratio-presets button {
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.82);
    border-radius: 999px;
    padding: 2px 7px;
    font-family: var(--fd);
    font-size: 8px;
    letter-spacing: .5px;
    cursor: pointer;
  }
  .plan-ratio-presets button:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.36);
    background: rgba(255, 255, 255, 0.11);
  }
  .plan-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .plan-action {
    flex: 1;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 7px 10px;
    font-family: var(--fd);
    font-size: 9px;
    letter-spacing: .8px;
    font-weight: 900;
    cursor: pointer;
  }
  .plan-action.ghost {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82);
  }
  .plan-action.ghost:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
  }
  .plan-action.primary {
    color: #fff;
    border-color: transparent;
  }
  .plan-action.primary.long {
    background: linear-gradient(135deg, rgba(39, 195, 145, 0.45), rgba(39, 195, 145, 0.7));
  }
  .plan-action.primary.short {
    background: linear-gradient(135deg, rgba(233, 91, 106, 0.45), rgba(233, 91, 106, 0.7));
  }
  .plan-action.primary:hover {
    filter: brightness(1.08);
  }

  .drag-indicator { position: absolute; bottom: 38px; left: 50%; transform: translateX(-50%); z-index: 15; padding: 4px 12px; border-radius: 6px; background: rgba(232,150,125,.9); color: #000; font-size: 9px; font-weight: 900; font-family: var(--fd); letter-spacing: 1.6px; animation: dragPulse .5s ease infinite; }
  @keyframes dragPulse { 0%,100% { opacity: 1 } 50% { opacity: .6 } }

  .chart-annotation { position: absolute; z-index: 8; width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--ann-color); background: rgba(0,0,0,.8); box-shadow: 0 0 10px var(--ann-color), 0 0 20px rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s; transform: translate(-50%, -50%); padding: 0; contain: layout style; }
  .chart-annotation::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; border: 1px solid var(--ann-color); opacity: 0; will-change: auto; }
  .chart-annotation::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; background: var(--ann-color); opacity: .08; z-index: -1; }
  .chart-annotation:hover { transform: translate(-50%, -50%) scale(1.35); box-shadow: 0 0 20px var(--ann-color), 0 0 30px var(--ann-color); }
  .chart-annotation.active { transform: translate(-50%, -50%) scale(1.25); box-shadow: 0 0 20px var(--ann-color), 0 0 30px var(--ann-color); z-index: 20; }
  .chart-annotation:hover::before { animation: annRing 2s ease-out; }
  @keyframes annRing { 0% { transform: scale(1); opacity: .4; } 100% { transform: scale(1.8); opacity: 0; } }
  .ann-icon { font-size: 13px; line-height: 1; filter: drop-shadow(0 0 2px var(--ann-color)); }

  .ann-popup { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); width: 200px; background: rgba(10,10,30,.95); border: 2px solid var(--ann-color); border-radius: 8px; padding: 8px; box-shadow: 0 4px 20px rgba(0,0,0,.5); animation: annPopIn .2s ease; pointer-events: none; }
  @keyframes annPopIn { from { opacity: 0; transform: translateX(-50%) translateY(5px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  .ann-popup-header { display: flex; align-items: center; gap: 4px; padding-bottom: 4px; border-bottom: 1px solid; margin-bottom: 4px; }
  .ann-popup-icon { font-size: 12px; }
  .ann-popup-name { font-family: var(--fm); font-size: 9px; font-weight: 900; letter-spacing: 1px; }
  .ann-popup-type { margin-left: auto; font-family: var(--fm); font-size: 7px; font-weight: 700; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,.1); color: rgba(255,255,255,.7); letter-spacing: .5px; }
  .ann-popup-label { font-family: var(--fm); font-size: 9px; font-weight: 900; color: #fff; margin-bottom: 2px; }
  .ann-popup-detail { font-family: var(--fm); font-size: 8px; color: rgba(255,255,255,.74); line-height: 1.4; }

  /* chart-footer removed — pattern pills shown on chart annotations, indicators in legend */

  /* Keep internal sections fixed-height friendly; pane resizing is handled at terminal layout level. */
  .chart-container,
  .indicator-strip {
    resize: none;
  }

  @media (max-width: 1580px) {
    .ind-hint { display: none; }
  }

  @media (max-width: 1280px) {
    .ind-chip.optional { display: none; }
  }

  @media (max-width: 480px) {
    .sum-title {
      display: none;
    }
    .sum-item.optional {
      display: none;
    }
  }

  .chart-wrapper.tv-like {
    --blk: #131722;
    --fg: #b2b5be;
    --yel: #4f8cff;
    --grn: #26a69a;
    --red: #ef5350;
    --pk: #b388ff;
    --cyan: #5ea1ff;
    --ora: #ffb74d;
    background: #131722;
  }
  .chart-wrapper.tv-like .chart-bar {
    background: #131722;
    border-bottom: 1px solid #2a2e39;
    gap: 4px;
  }
  .chart-wrapper.tv-like .indicator-strip {
    border-bottom-color: #2a2e39;
    background: #131722;
  }
  .chart-wrapper.tv-like .mode-toggle {
    border-color: rgba(255, 255, 255, 0.18);
  }
  .chart-wrapper.tv-like .mode-btn.active {
    background: rgba(79, 140, 255, 0.2);
    color: #e6f0ff;
    text-shadow: none;
  }
  .chart-wrapper.tv-like .scan-btn {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(79, 140, 255, 0.2);
    color: #e6f0ff;
  }
  .chart-wrapper.tv-like .scan-btn:hover {
    border-color: rgba(79, 140, 255, 0.6);
    background: rgba(79, 140, 255, 0.3);
    color: #fff;
    box-shadow: none;
  }
  .chart-wrapper.tv-like .scan-btn.chat-trigger.ready {
    border-color: rgba(38, 166, 154, 0.62);
    background: rgba(38, 166, 154, 0.24);
    color: #d9fffa;
  }
  .chart-wrapper.tv-like .scan-btn.chat-trigger.ready:hover {
    border-color: rgba(38, 166, 154, 0.8);
    background: rgba(38, 166, 154, 0.33);
    color: #f2ffff;
  }
  .chart-wrapper.tv-like .scan-btn.view-btn.long {
    border-color: rgba(38,166,154,.7);
    background: rgba(38,166,154,.24);
    color: #e7fffb;
  }
  .chart-wrapper.tv-like .scan-btn.view-btn.short {
    border-color: rgba(239,83,80,.68);
    background: rgba(239,83,80,.24);
    color: #ffeef0;
  }
  .chart-wrapper.tv-like .draw-btn.active {
    border-color: rgba(79, 140, 255, 0.8);
    background: rgba(79, 140, 255, 0.24);
    box-shadow: none;
  }
  .chart-wrapper.tv-like .tfbtn.active {
    color: #e6f0ff;
    border-color: rgba(79, 140, 255, 0.8);
    background: rgba(79, 140, 255, 0.22);
  }
  .chart-wrapper.tv-like .live-indicator {
    color: #8bd0ff;
  }
  .chart-wrapper.tv-like .live-dot {
    background: #8bd0ff;
  }
</style>
